import { nextMonday } from "./datePicker.ts";
import { readProject } from "./project.ts";
import { addDays, isDateString } from "./schedule.ts";
import type { TodoPriority, TodoRecurrence } from "./types.ts";

export type ParsedTodoInput = {
  title: string;
  project?: string;
  priority?: TodoPriority;
  date?: string;
  recurrence?: TodoRecurrence;
};

const PRIORITY_TOKENS: Readonly<Record<string, TodoPriority>> = {
  "!1": "high",
  "!2": "medium",
  "!3": "low",
  "！1": "high",
  "！2": "medium",
  "！3": "low",
  p1: "high",
  p2: "medium",
  p3: "low",
};

const NEXT_WEEKDAY_OFFSETS: Readonly<Record<string, number>> = {
  一: 0,
  二: 1,
  三: 2,
  四: 3,
  五: 4,
  六: 5,
  日: 6,
  天: 6,
};

const RECURRENCE_TOKENS: Readonly<Record<string, TodoRecurrence["kind"]>> = {
  每天: "daily",
  每日: "daily",
  daily: "daily",
  工作日: "workdays",
  法定工作日: "workdays",
  workday: "workdays",
  workdays: "workdays",
  每周: "weekly",
  weekly: "weekly",
  每月: "monthly",
  monthly: "monthly",
  每年: "yearly",
  yearly: "yearly",
  农历每年: "lunarYearly",
  每年农历: "lunarYearly",
};

function parsePriorityToken(token: string): TodoPriority | undefined {
  return PRIORITY_TOKENS[token.toLowerCase()];
}

function parseProjectToken(token: string): string | undefined {
  if (!token.startsWith("#") || token.length <= 1) return undefined;
  const raw = token.slice(1);
  if (raw.includes("#") || /^\d+$/u.test(raw)) return undefined;
  return readProject(raw);
}

function parseRecurrenceToken(token: string): TodoRecurrence | undefined {
  if (!token.startsWith("@") && !token.startsWith("＠")) return undefined;
  const body = token.slice(1).toLowerCase();
  const kind = RECURRENCE_TOKENS[body];
  return kind ? { kind } : undefined;
}

function parseMonthDay(raw: string, today: string): string | undefined {
  const match = /^(\d{1,2})-(\d{1,2})$/u.exec(raw);
  if (!match) return undefined;
  const month = match[1].padStart(2, "0");
  const day = match[2].padStart(2, "0");
  const baseYear = Number(today.slice(0, 4));
  if (!Number.isFinite(baseYear)) return undefined;
  const thisYear = `${baseYear}-${month}-${day}`;
  if (isDateString(thisYear) && thisYear >= today) return thisYear;
  const nextYear = `${baseYear + 1}-${month}-${day}`;
  if (isDateString(nextYear)) return nextYear;
  return isDateString(thisYear) ? thisYear : undefined;
}

function parseDateToken(token: string, today: string): string | undefined {
  if (!token.startsWith("@") && !token.startsWith("＠")) return undefined;
  const body = token.slice(1);
  if (!body) return undefined;
  const lower = body.toLowerCase();
  if (body === "今天" || lower === "today") return today;
  if (body === "明天" || lower === "tomorrow") return addDays(today, 1);
  if (body === "后天") return addDays(today, 2);
  const nextWeekMatch = /^下周([一二三四五六日天])$/u.exec(body);
  if (nextWeekMatch) {
    const offset = NEXT_WEEKDAY_OFFSETS[nextWeekMatch[1]];
    return addDays(nextMonday(today), offset);
  }
  if (isDateString(body)) return body;
  return parseMonthDay(body, today);
}

export function parseTodoInlineSyntax(input: string, today: string, inlineSyntax = true): ParsedTodoInput {
  const trimmed = input.trim();
  if (!trimmed) return { title: "" };
  if (!inlineSyntax) return { title: trimmed };

  const tokens = trimmed.split(/\s+/u);
  if (tokens.length <= 1) return { title: trimmed };

  let project: string | undefined;
  let priority: TodoPriority | undefined;
  let date: string | undefined;
  let recurrence: TodoRecurrence | undefined;
  const kept: string[] = [];
  let seenContent = false;

  const isMetaToken = (candidate: string) =>
    parsePriorityToken(candidate) !== undefined ||
    parseRecurrenceToken(candidate) !== undefined ||
    (isDateString(today) && parseDateToken(candidate, today) !== undefined);

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const trailingMetaOnly = tokens.slice(index + 1).every(isMetaToken);
    const allowProject = !seenContent || trailingMetaOnly;
    if (project === undefined && allowProject) {
      const parsedProject = parseProjectToken(token);
      if (parsedProject !== undefined) {
        project = parsedProject;
        continue;
      }
    }
    if (priority === undefined) {
      const parsedPriority = parsePriorityToken(token);
      if (parsedPriority !== undefined) {
        priority = parsedPriority;
        continue;
      }
    }
    if (recurrence === undefined) {
      const parsedRecurrence = parseRecurrenceToken(token);
      if (parsedRecurrence !== undefined) {
        recurrence = parsedRecurrence;
        continue;
      }
    }
    if (date === undefined && isDateString(today)) {
      const parsedDate = parseDateToken(token, today);
      if (parsedDate !== undefined) {
        date = parsedDate;
        continue;
      }
    }
    seenContent = true;
    kept.push(token);
  }

  const title = kept.join(" ").trim();
  if (!title) return { title: trimmed };

  return {
    title,
    ...(project ? { project } : {}),
    ...(priority ? { priority } : {}),
    ...(date ? { date } : {}),
    ...(recurrence ? { recurrence } : {}),
  };
}
