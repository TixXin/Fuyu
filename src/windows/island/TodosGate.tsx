import { useEffect, useState, type ReactNode } from "react";
import { prepareTodoStore } from "../../features/todos/todoMigration";

export function TodosGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    void prepareTodoStore().finally(() => {
      if (mounted) setReady(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  return ready ? children : null;
}
