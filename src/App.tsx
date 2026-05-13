/* eslint-disable jsx-a11y/control-has-associated-label */
/* eslint-disable jsx-a11y/label-has-associated-control */
import React, {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import classNames from 'classnames';
import { UserWarning } from './UserWarning';

const API_URL = 'https://mate.academy/students-api/todos';
const USER_ID = 4203;

type Todo = {
  id: number;
  userId: number;
  title: string;
  completed: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type Filter = 'all' | 'active' | 'completed';

enum ErrorMessage {
  Load = 'Unable to load todos',
  EmptyTitle = 'Title should not be empty',
  Add = 'Unable to add a todo',
  Delete = 'Unable to delete a todo',
  Update = 'Unable to update a todo',
}

const getUserId = () => {
  try {
    const user = localStorage.getItem('user');

    return user ? Number(JSON.parse(user).id) : USER_ID;
  } catch {
    return USER_ID;
  }
};

const request = async <T,>(url: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(String(response.status));
  }

  return response.json();
};

export const App: React.FC = () => {
  const userId = getUserId();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [newTitle, setNewTitle] = useState('');
  const [tempTodo, setTempTodo] = useState<Todo | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [processingIds, setProcessingIds] = useState<number[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const errorTimerId = useRef<ReturnType<typeof setTimeout> | null>(null);
  const newTodoField = useRef<HTMLInputElement>(null);
  const editField = useRef<HTMLInputElement>(null);

  const showError = (message: ErrorMessage) => {
    setErrorMessage(message);

    if (errorTimerId.current) {
      clearTimeout(errorTimerId.current);
    }

    errorTimerId.current = setTimeout(() => {
      setErrorMessage('');
    }, 3000);
  };

  const hideError = () => {
    setErrorMessage('');

    if (errorTimerId.current) {
      clearTimeout(errorTimerId.current);
    }
  };

  const focusNewTodoField = () => {
    setTimeout(() => newTodoField.current?.focus(), 0);
  };

  const addProcessingId = (id: number) => {
    setProcessingIds(current => [...current, id]);
  };

  const removeProcessingId = (id: number) => {
    setProcessingIds(current => current.filter(currentId => currentId !== id));
  };

  const loadTodos = async () => {
    try {
      const loadedTodos = await request<Todo[]>(`${API_URL}?userId=${userId}`);

      setTodos(loadedTodos);
    } catch {
      showError(ErrorMessage.Load);
    } finally {
      focusNewTodoField();
    }
  };

  useEffect(() => {
    if (userId) {
      loadTodos();
    }

    return () => {
      if (errorTimerId.current) {
        clearTimeout(errorTimerId.current);
      }
    };
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (editingId !== null) {
      editField.current?.focus();
    }
  }, [editingId]);

  const visibleTodos = useMemo(() => {
    switch (filter) {
      case 'active':
        return todos.filter(todo => !todo.completed);

      case 'completed':
        return todos.filter(todo => todo.completed);

      default:
        return todos;
    }
  }, [filter, todos]);

  const activeTodosCount = todos.filter(todo => !todo.completed).length;
  const completedTodosCount = todos.length - activeTodosCount;
  const allTodosCompleted = todos.length > 0 && activeTodosCount === 0;
  const shouldShowTempTodo = tempTodo && filter !== 'completed';

  const createTodo = async (event: FormEvent) => {
    event.preventDefault();
    hideError();

    const title = newTitle.trim();

    if (!title) {
      showError(ErrorMessage.EmptyTitle);
      focusNewTodoField();

      return;
    }

    const optimisticTodo: Todo = {
      id: 0,
      userId,
      title,
      completed: false,
    };

    setTempTodo(optimisticTodo);
    setIsAdding(true);

    try {
      const createdTodo = await request<Todo>(API_URL, {
        method: 'POST',
        body: JSON.stringify({
          userId,
          title,
          completed: false,
        }),
      });

      setTodos(current => [...current, createdTodo]);
      setNewTitle('');
    } catch {
      showError(ErrorMessage.Add);
    } finally {
      setIsAdding(false);
      setTempTodo(null);
      focusNewTodoField();
    }
  };

  const deleteTodo = async (todoId: number, shouldFocusNewTodo = true) => {
    hideError();
    addProcessingId(todoId);

    try {
      await fetch(`${API_URL}/${todoId}`, {
        method: 'DELETE',
      }).then(response => {
        if (!response.ok) {
          throw new Error(String(response.status));
        }
      });

      setTodos(current => current.filter(todo => todo.id !== todoId));

      if (editingId === todoId) {
        setEditingId(null);
      }
    } catch {
      showError(ErrorMessage.Delete);
      throw new Error(ErrorMessage.Delete);
    } finally {
      removeProcessingId(todoId);
      if (shouldFocusNewTodo) {
        focusNewTodoField();
      }
    }
  };

  const updateTodo = async (
    todoId: number,
    data: Partial<Pick<Todo, 'title' | 'completed'>>,
  ) => {
    hideError();
    addProcessingId(todoId);

    try {
      const updatedTodo = await request<Todo>(`${API_URL}/${todoId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });

      setTodos(current =>
        current.map(todo =>
          todo.id === todoId ? { ...todo, ...updatedTodo } : todo,
        ),
      );

      return updatedTodo;
    } catch {
      showError(ErrorMessage.Update);
      throw new Error(ErrorMessage.Update);
    } finally {
      removeProcessingId(todoId);
    }
  };

  const toggleTodo = (todo: Todo) => {
    updateTodo(todo.id, { completed: !todo.completed }).catch(() => {});
  };

  const toggleAll = async () => {
    const completed = !allTodosCompleted;
    const todosToUpdate = todos.filter(todo => todo.completed !== completed);

    await Promise.all(
      todosToUpdate.map(todo =>
        updateTodo(todo.id, { completed }).catch(() => undefined),
      ),
    );
  };

  const deleteCompletedTodos = async () => {
    await Promise.all(
      todos
        .filter(todo => todo.completed)
        .map(todo => deleteTodo(todo.id).catch(() => undefined)),
    );
  };

  const startEditing = (todo: Todo) => {
    setEditingId(todo.id);
    setEditingTitle(todo.title);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingTitle('');
  };

  const saveEditing = async (todo: Todo) => {
    const title = editingTitle.trim();

    if (title === todo.title) {
      cancelEditing();

      return;
    }

    if (!title) {
      try {
        await deleteTodo(todo.id, false);
      } catch {
        return;
      }

      return;
    }

    try {
      await updateTodo(todo.id, { title });
      cancelEditing();
    } catch {
      editField.current?.focus();
    }
  };

  const handleEditSubmit = (event: FormEvent, todo: Todo) => {
    event.preventDefault();
    saveEditing(todo);
  };

  const handleEditKeyUp = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      cancelEditing();
    }
  };

  const filterLinkClass = (linkFilter: Filter) =>
    classNames('filter__link', {
      selected: filter === linkFilter,
    });

  if (!userId) {
    return <UserWarning />;
  }

  return (
    <div className="todoapp">
      <h1 className="todoapp__title">todos</h1>

      <div className="todoapp__content">
        <header className="todoapp__header">
          {todos.length > 0 && (
            <button
              type="button"
              className={classNames('todoapp__toggle-all', {
                active: allTodosCompleted,
              })}
              data-cy="ToggleAllButton"
              onClick={toggleAll}
            />
          )}

          <form onSubmit={createTodo}>
            <input
              ref={newTodoField}
              type="text"
              className="todoapp__new-todo"
              data-cy="NewTodoField"
              placeholder="What needs to be done?"
              value={newTitle}
              disabled={isAdding}
              onChange={event => setNewTitle(event.target.value)}
            />
          </form>
        </header>

        {(todos.length > 0 || shouldShowTempTodo) && (
          <section className="todoapp__main">
            {visibleTodos.map(todo => {
              const isEditing = editingId === todo.id;
              const isProcessing = processingIds.includes(todo.id);

              return (
                <div
                  key={todo.id}
                  className={classNames('todo', {
                    completed: todo.completed,
                  })}
                  data-cy="Todo"
                >
                  <label className="todo__status-label">
                    <input
                      type="checkbox"
                      className="todo__status"
                      data-cy="TodoStatus"
                      checked={todo.completed}
                      onChange={() => toggleTodo(todo)}
                    />
                  </label>

                  {isEditing ? (
                    <form onSubmit={event => handleEditSubmit(event, todo)}>
                      <input
                        ref={editField}
                        type="text"
                        className="todo__title-field"
                        data-cy="TodoTitleField"
                        value={editingTitle}
                        onChange={event => setEditingTitle(event.target.value)}
                        onBlur={() => saveEditing(todo)}
                        onKeyUp={handleEditKeyUp}
                      />
                    </form>
                  ) : (
                    <>
                      <span
                        className="todo__title"
                        data-cy="TodoTitle"
                        onDoubleClick={() => startEditing(todo)}
                      >
                        {todo.title}
                      </span>

                      <button
                        type="button"
                        className="todo__remove"
                        data-cy="TodoDelete"
                        onClick={() => deleteTodo(todo.id).catch(() => {})}
                      >
                        ×
                      </button>
                    </>
                  )}

                  <div
                    className={classNames('modal overlay', {
                      'is-active': isProcessing,
                    })}
                    data-cy="TodoLoader"
                  >
                    <div
                      className={classNames(
                        'modal-background',
                        'has-background-white-ter',
                      )}
                    />
                    <div className="loader" />
                  </div>
                </div>
              );
            })}

            {shouldShowTempTodo && (
              <div className="todo" data-cy="Todo">
                <label className="todo__status-label">
                  <input
                    type="checkbox"
                    className="todo__status"
                    data-cy="TodoStatus"
                    checked={tempTodo.completed}
                    readOnly
                  />
                </label>

                <span className="todo__title" data-cy="TodoTitle">
                  {tempTodo.title}
                </span>

                <div className="modal overlay is-active" data-cy="TodoLoader">
                  <div
                    className={classNames(
                      'modal-background',
                      'has-background-white-ter',
                    )}
                  />
                  <div className="loader" />
                </div>
              </div>
            )}
          </section>
        )}

        {todos.length > 0 && (
          <footer className="todoapp__footer">
            <span className="todo-count" data-cy="TodosCounter">
              {`${activeTodosCount} ${activeTodosCount === 1 ? 'item' : 'items'} left`}
            </span>

            <nav className="filter" data-cy="Filter">
              <a
                href="#/"
                className={filterLinkClass('all')}
                data-cy="FilterLinkAll"
                onClick={() => setFilter('all')}
              >
                All
              </a>

              <a
                href="#/active"
                className={filterLinkClass('active')}
                data-cy="FilterLinkActive"
                onClick={() => setFilter('active')}
              >
                Active
              </a>

              <a
                href="#/completed"
                className={filterLinkClass('completed')}
                data-cy="FilterLinkCompleted"
                onClick={() => setFilter('completed')}
              >
                Completed
              </a>
            </nav>

            <button
              type="button"
              className="todoapp__clear-completed"
              data-cy="ClearCompletedButton"
              disabled={completedTodosCount === 0}
              onClick={deleteCompletedTodos}
            >
              Clear completed
            </button>
          </footer>
        )}
      </div>

      <div
        className={classNames(
          'notification is-danger is-light has-text-weight-normal',
          { hidden: !errorMessage },
        )}
        data-cy="ErrorNotification"
      >
        <button
          type="button"
          className="delete"
          data-cy="HideErrorButton"
          onClick={hideError}
        />
        {errorMessage}
      </div>
    </div>
  );
};
