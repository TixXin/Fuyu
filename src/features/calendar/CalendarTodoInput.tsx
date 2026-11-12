import { useState } from "react";
import { Plus } from "lucide-react";
import { useTranslation } from "../../i18n";

/**
 * The calendar page's "add a todo" row under a day (issue #43): Enter adds the title to that day,
 * today's list for today, planned for a later day. Days before today have none.
 */
export function CalendarTodoInput({ label, onAdd }: { label: string; onAdd: (title: string) => void }) {
  const text = useTranslation().calendar;
  const [title, setTitle] = useState("");
  const add = () => {
    if (!title.trim()) return;
    onAdd(title);
    setTitle("");
  };
  return (
    <form className="calendar-todo-input" onSubmit={(event) => { event.preventDefault(); add(); }}>
      <Plus size={13} strokeWidth={2.2} aria-hidden="true" />
      <input
        value={title}
        placeholder={text.addTodo}
        aria-label={text.addTodoOn(label)}
        onChange={(event) => setTitle(event.currentTarget.value)}
        onKeyDown={(event) => { if (event.key === "Escape") setTitle(""); }}
      />
    </form>
  );
}
