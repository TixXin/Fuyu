import { TaskbarLyrics } from "../../features/media/taskbar/TaskbarLyrics";
import { askIsland, type TaskbarLyricsRequest } from "../../features/media/taskbar/api";
import { taskbarLyricsWidth } from "../../features/media/taskbar/taskbarLyricsActive";
import { useTaskbarLyricsDock } from "./useTaskbarLyricsDock";
import { useTaskbarLyricsFeedIn } from "./useTaskbarLyricsFeedIn";

const request = (next: TaskbarLyricsRequest) => void askIsland(next).catch(() => undefined);

export function TaskbarLyricsWindow() {
  const feed = useTaskbarLyricsFeedIn();
  const dock = useTaskbarLyricsDock(taskbarLyricsWidth(feed));
  return <TaskbarLyrics feed={feed} light={dock?.light === true} onRequest={request} />;
}
