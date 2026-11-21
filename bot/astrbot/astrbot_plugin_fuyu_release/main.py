import asyncio

from astrbot.api import AstrBotConfig, logger
from astrbot.api.event import AstrMessageEvent, MessageChain, filter
from astrbot.api.message_components import Image, Plain
from astrbot.api.star import Context, Star, StarTools

from .inbox import Release, archive, caption, latest_release, read_releases

PLUGIN_NAME = "astrbot_plugin_fuyu_release"
MAX_ATTEMPTS = 3


class FuyuRelease(Star):
    def __init__(self, context: Context, config: AstrBotConfig):
        super().__init__(context)
        self.config = config
        data_dir = StarTools.get_data_dir(PLUGIN_NAME)
        self.inbox = data_dir / "inbox"
        self.sent = data_dir / "sent"
        self.failed = data_dir / "failed"
        self.inbox.mkdir(parents=True, exist_ok=True)
        self.attempts: dict[str, int] = {}
        self.warned_no_targets = False
        self.task = asyncio.create_task(self.watch())

    def targets(self) -> list[str]:
        found = [str(item).strip() for item in self.config.get("targets", []) if str(item).strip()]
        if self.config.get("notify_admins", True):
            platform = str(self.config.get("platform_id") or "default")
            admins = self.context.get_config().get("admins_id", [])
            found += [f"{platform}:FriendMessage:{admin}" for admin in admins if str(admin).strip().isdigit()]
        return list(dict.fromkeys(found))

    async def watch(self) -> None:
        while True:
            try:
                await self.deliver_pending()
            except asyncio.CancelledError:
                raise
            except Exception as error:
                logger.error(f"[{PLUGIN_NAME}] {error!r}")
            await asyncio.sleep(max(5, int(self.config.get("poll_seconds", 10))))

    async def deliver_pending(self) -> None:
        releases = read_releases(self.inbox)
        if not releases:
            return
        targets = self.targets()
        if not targets:
            if not self.warned_no_targets:
                logger.warning(f"[{PLUGIN_NAME}] no targets: set targets or admins_id")
                self.warned_no_targets = True
            return
        self.warned_no_targets = False
        for release in releases:
            delivered = await self.deliver(release, targets)
            key = release.manifest.name
            if delivered:
                archive(release, self.sent)
                self.attempts.pop(key, None)
                logger.info(f"[{PLUGIN_NAME}] sent v{release.version} to {delivered}/{len(targets)} targets")
                continue
            self.attempts[key] = self.attempts.get(key, 0) + 1
            if self.attempts[key] >= MAX_ATTEMPTS:
                archive(release, self.failed)
                self.attempts.pop(key, None)
                logger.error(f"[{PLUGIN_NAME}] gave up on v{release.version}, moved to failed/")

    async def deliver(self, release: Release, targets: list[str]) -> int:
        delivered = 0
        for target in targets:
            chain = MessageChain().message(caption(release)).file_image(str(release.image))
            try:
                if await self.context.send_message(target, chain):
                    delivered += 1
                else:
                    logger.warning(f"[{PLUGIN_NAME}] no platform for {target}")
            except Exception as error:
                logger.warning(f"[{PLUGIN_NAME}] could not send to {target}: {error!r}")
        return delivered

    @filter.permission_type(filter.PermissionType.ADMIN)
    @filter.command("浮屿分享图")
    async def resend(self, event: AstrMessageEvent):
        release = latest_release(self.sent)
        if release is None:
            yield event.plain_result("还没有推送过浮屿的分享图。")
            return
        yield event.chain_result([Plain(caption(release)), Image.fromFileSystem(str(release.image))])

    @filter.permission_type(filter.PermissionType.ADMIN)
    @filter.command("浮屿推送状态")
    async def status(self, event: AstrMessageEvent):
        waiting = len(read_releases(self.inbox, now=float("inf")))
        latest = latest_release(self.sent)
        lines = [
            f"等待推送：{waiting} 个",
            f"推送对象：{len(self.targets())} 个",
            f"最近推送：v{latest.version}" if latest else "最近推送：无",
        ]
        yield event.plain_result("\n".join(lines))

    async def terminate(self):
        self.task.cancel()
