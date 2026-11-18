export type TodoText = {
  empty: string;
  emptyReview: string;
  complete: string;
  markIncomplete: string;
  actionOnTask: (action: string, taskTitle: string) => string;
  editTitle: string;
  start: string;
  stop: string;
  elapsedFocus: (elapsed: string) => string;
  delete: string;
  deleteTask: (taskTitle: string) => string;
  reorderTask: (taskTitle: string) => string;
  expandDetails: (taskTitle: string) => string;
  collapseDetails: (taskTitle: string) => string;
  deleteSubtask: (subtaskTitle: string) => string;
  pluginMenu: string;
};

export const zhCN: TodoText = {
  empty: "今天还很轻",
  emptyReview: "Nothing was written here",
  complete: "完成",
  markIncomplete: "标记未完成",
  actionOnTask: (action, taskTitle) => `${action}：${taskTitle}`,
  editTitle: "编辑任务名",
  start: "开始",
  stop: "结束",
  elapsedFocus: (elapsed) => `已进行 ${elapsed}`,
  delete: "删除",
  deleteTask: (taskTitle) => `删除：${taskTitle}`,
  reorderTask: (taskTitle) => `拖动排序：${taskTitle}`,
  expandDetails: (taskTitle) => `展开子步骤与备注：${taskTitle}`,
  collapseDetails: (taskTitle) => `收起子步骤与备注：${taskTitle}`,
  deleteSubtask: (subtaskTitle) => `删除子步骤：${subtaskTitle}`,
  pluginMenu: "插件操作",
};

export const en: TodoText = {
  empty: "A light day so far",
  emptyReview: "Nothing was written here",
  complete: "Complete",
  markIncomplete: "Mark incomplete",
  actionOnTask: (action, taskTitle) => `${action}: ${taskTitle}`,
  editTitle: "Edit task name",
  start: "Start",
  stop: "Stop",
  elapsedFocus: (elapsed) => `${elapsed} elapsed`,
  delete: "Delete",
  deleteTask: (taskTitle) => `Delete: ${taskTitle}`,
  reorderTask: (taskTitle) => `Reorder: ${taskTitle}`,
  expandDetails: (taskTitle) => `Expand subtasks and note: ${taskTitle}`,
  collapseDetails: (taskTitle) => `Collapse subtasks and note: ${taskTitle}`,
  deleteSubtask: (subtaskTitle) => `Delete subtask: ${subtaskTitle}`,
  pluginMenu: "Plugin actions",
};
