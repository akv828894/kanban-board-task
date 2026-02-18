import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import "./App.css";

const STORAGE_KEY = "kanban_tasks_v1";

const initialTasks = [
  { id: 1, title: "Create wireframe", status: "todo", priority: "High" },
  { id: 2, title: "Set up React project", status: "inprogress", priority: "Medium" },
  { id: 3, title: "Deploy test build", status: "done", priority: "Low" },
];

const columns = [
  { key: "todo", title: "To Do" },
  { key: "inprogress", title: "In Progress" },
  { key: "done", title: "Done" },
];

const priorities = ["High", "Medium", "Low"];
const statusFlow = columns.map((column) => column.key);

function getColumnTitle(status) {
  return columns.find((column) => column.key === status)?.title ?? status;
}

function getStatusFromDroppableId(id) {
  if (typeof id !== "string") {
    return null;
  }

  if (id.startsWith("column-")) {
    const status = id.replace("column-", "");
    return statusFlow.includes(status) ? status : null;
  }

  return null;
}

function loadTasksFromStorage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return initialTasks;
    }

    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) {
      return initialTasks;
    }

    return parsed.filter(
      (task) =>
        task &&
        typeof task.id !== "undefined" &&
        typeof task.title === "string" &&
        statusFlow.includes(task.status) &&
        priorities.includes(task.priority)
    );
  } catch {
    return initialTasks;
  }
}

function BoardColumn({ column, count, children }) {
  const { isOver, setNodeRef } = useDroppable({ id: `column-${column.key}` });

  return (
    <section ref={setNodeRef} className={`column ${isOver ? "column-over" : ""}`}>
      <div className="column-header">
        <h2>{column.title}</h2>
        <span className="count">{count}</span>
      </div>
      <div className="cards">{children}</div>
    </section>
  );
}

function TaskCard({
  task,
  previousStatus,
  nextStatus,
  previousLabel,
  nextLabel,
  isEditing,
  editingTitle,
  onEditingTitleChange,
  onEditKeyDown,
  onSaveEdit,
  onCancelEdit,
  onStartEditing,
  onMoveTask,
  onDeleteTask,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useDraggable({
    id: `task-${task.id}`,
    data: { taskId: task.id },
  });

  const dragStyle = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <article
      ref={setNodeRef}
      style={dragStyle}
      className={`card priority-${task.priority.toLowerCase()} ${isDragging ? "card-dragging" : ""}`}
    >
      <div className="card-top">
        <button
          className="drag-handle"
          type="button"
          aria-label={`Drag ${task.title}`}
          {...listeners}
          {...attributes}
        >
          Drag
        </button>
      </div>

      {isEditing ? (
        <div className="edit-area">
          <input
            className="edit-input"
            type="text"
            value={editingTitle}
            onChange={(event) => onEditingTitleChange(event.target.value)}
            onKeyDown={(event) => onEditKeyDown(event, task.id)}
            autoFocus
          />
          <div className="edit-actions">
            <button className="action-btn" type="button" onClick={() => onSaveEdit(task.id)}>
              Save
            </button>
            <button className="action-btn" type="button" onClick={onCancelEdit}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button className="title-btn" type="button" onClick={() => onStartEditing(task)}>
          {task.title}
        </button>
      )}

      <span className="badge">{task.priority}</span>

      <div className="card-actions">
        {previousStatus && (
          <button className="action-btn" type="button" onClick={() => onMoveTask(task.id, -1)}>
            Move to {previousLabel}
          </button>
        )}

        {nextStatus && (
          <button className="action-btn" type="button" onClick={() => onMoveTask(task.id, 1)}>
            Move to {nextLabel}
          </button>
        )}

        <button className="action-btn danger-btn" type="button" onClick={() => onDeleteTask(task.id)}>
          X Delete
        </button>
      </div>
    </article>
  );
}

function DragPreviewCard({ task }) {
  return (
    <article className={`card overlay-card priority-${task.priority.toLowerCase()}`}>
      <button className="title-btn" type="button">
        {task.title}
      </button>
      <span className="badge">{task.priority}</span>
    </article>
  );
}

function App() {
  const [tasks, setTasks] = useState(loadTasksFromStorage);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("Medium");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [activeTaskId, setActiveTaskId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  const visibleTasks = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return tasks;
    }

    return tasks.filter((task) => task.title.toLowerCase().includes(normalizedQuery));
  }, [tasks, searchQuery]);

  const activeTask = useMemo(
    () => tasks.find((task) => task.id === activeTaskId) ?? null,
    [tasks, activeTaskId]
  );

  function handleAddTask(event) {
    event.preventDefault();
    const title = newTaskTitle.trim();

    if (!title) {
      return;
    }

    const task = {
      id: Date.now(),
      title,
      status: "todo",
      priority: newTaskPriority,
    };

    setTasks((previousTasks) => [task, ...previousTasks]);
    setNewTaskTitle("");
    setNewTaskPriority("Medium");
  }

  function handleDeleteTask(taskId) {
    setTasks((previousTasks) => previousTasks.filter((task) => task.id !== taskId));

    if (editingTaskId === taskId) {
      setEditingTaskId(null);
      setEditingTitle("");
    }
  }

  function handleMoveTask(taskId, direction) {
    setTasks((previousTasks) =>
      previousTasks.map((task) => {
        if (task.id !== taskId) {
          return task;
        }

        const currentIndex = statusFlow.indexOf(task.status);
        const targetIndex = currentIndex + direction;

        if (targetIndex < 0 || targetIndex >= statusFlow.length) {
          return task;
        }

        return {
          ...task,
          status: statusFlow[targetIndex],
        };
      })
    );
  }

  function startEditing(task) {
    setEditingTaskId(task.id);
    setEditingTitle(task.title);
  }

  function cancelEditing() {
    setEditingTaskId(null);
    setEditingTitle("");
  }

  function saveEditing(taskId) {
    const cleanedTitle = editingTitle.trim();

    if (!cleanedTitle) {
      return;
    }

    setTasks((previousTasks) =>
      previousTasks.map((task) => (task.id === taskId ? { ...task, title: cleanedTitle } : task))
    );

    cancelEditing();
  }

  function handleEditKeyDown(event, taskId) {
    if (event.key === "Enter") {
      event.preventDefault();
      saveEditing(taskId);
    }

    if (event.key === "Escape") {
      cancelEditing();
    }
  }

  function handleDragStart(event) {
    const taskId = event.active.data.current?.taskId;
    if (typeof taskId === "number") {
      setActiveTaskId(taskId);
    }
  }

  function handleDragCancel() {
    setActiveTaskId(null);
  }

  function handleDragEnd(event) {
    setActiveTaskId(null);

    const taskId = event.active.data.current?.taskId;
    const targetStatus = getStatusFromDroppableId(event.over?.id);

    if (typeof taskId !== "number" || !targetStatus) {
      return;
    }

    setTasks((previousTasks) =>
      previousTasks.map((task) => (task.id === taskId ? { ...task, status: targetStatus } : task))
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <h1>Kanban Task Board</h1>
        <p>Level 3: Drag-and-drop + Search + Level 2 features included</p>
      </header>

      <div className="toolbar">
        <form className="add-task-form" onSubmit={handleAddTask}>
          <input
            className="task-input"
            type="text"
            placeholder="Enter a new task..."
            value={newTaskTitle}
            onChange={(event) => setNewTaskTitle(event.target.value)}
          />

          <select
            className="priority-select"
            value={newTaskPriority}
            onChange={(event) => setNewTaskPriority(event.target.value)}
          >
            {priorities.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>

          <button className="add-btn" type="submit">
            Add Task
          </button>
        </form>

        <input
          className="search-input"
          type="text"
          placeholder="Search tasks..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
        />
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragCancel={handleDragCancel}
        onDragEnd={handleDragEnd}
      >
        <main className="board">
          {columns.map((column) => {
            const columnTasks = visibleTasks.filter((task) => task.status === column.key);

            return (
              <BoardColumn key={column.key} column={column} count={columnTasks.length}>
                {columnTasks.length === 0 && <p className="empty-column">Drop tasks here</p>}

                {columnTasks.map((task) => {
                  const currentIndex = statusFlow.indexOf(task.status);
                  const previousStatus = statusFlow[currentIndex - 1];
                  const nextStatus = statusFlow[currentIndex + 1];

                  return (
                    <TaskCard
                      key={task.id}
                      task={task}
                      previousStatus={previousStatus}
                      nextStatus={nextStatus}
                      previousLabel={getColumnTitle(previousStatus)}
                      nextLabel={getColumnTitle(nextStatus)}
                      isEditing={editingTaskId === task.id}
                      editingTitle={editingTitle}
                      onEditingTitleChange={setEditingTitle}
                      onEditKeyDown={handleEditKeyDown}
                      onSaveEdit={saveEditing}
                      onCancelEdit={cancelEditing}
                      onStartEditing={startEditing}
                      onMoveTask={handleMoveTask}
                      onDeleteTask={handleDeleteTask}
                    />
                  );
                })}
              </BoardColumn>
            );
          })}
        </main>

        <DragOverlay>{activeTask ? <DragPreviewCard task={activeTask} /> : null}</DragOverlay>
      </DndContext>
    </div>
  );
}

export default App;