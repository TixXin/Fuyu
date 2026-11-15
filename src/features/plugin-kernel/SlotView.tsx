import type { ReactNode } from "react";
import { SlotItems } from "@fuyu/plugin-base/client/react";
import type { SlotItem } from "@fuyu/plugin-base/client/slots";
import { reportSlotError, type SlotEntry, type SlotFailure, type SlotHandle } from "./slots";
import "./PluginSlot.css";

type PropsField<Props extends object> = Record<never, never> extends Props ? { props?: NoInfer<Props> } : { props: NoInfer<Props> };

type SlotViewProps<Props extends object, Meta extends object> = PropsField<Props> & {
  slot: SlotHandle<Props, Meta>;
  group?: string;
  select?: (items: readonly SlotEntry<NoInfer<Props>, NoInfer<Meta>>[]) => readonly SlotEntry<NoInfer<Props>, NoInfer<Meta>>[];
  onError?: (failure: SlotFailure) => void;
};

export function SlotView<Props extends object, Meta extends object>({ slot, group, select, onError = reportSlotError, ...rest }: SlotViewProps<Props, Meta>) {
  const wrap = (item: SlotItem, node: ReactNode) =>
    item.external ? (
      <div className="plugin-slot" data-slot={slot.name}>
        {node}
      </div>
    ) : (
      node
    );
  const pick = select && ((items: SlotItem[]) => select(items as unknown as SlotEntry<Props, Meta>[]) as unknown as SlotItem[]);
  return <SlotItems registry={slot.registry} name={slot.name} group={group} props={(rest as { props?: Props }).props} select={pick} wrap={wrap} onError={onError} />;
}
