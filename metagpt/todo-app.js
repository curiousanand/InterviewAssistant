// Todo App Functions
let todos = [];
let nextId = 1;

function addTodo(text) {
  if (!text || text.trim() === '') {
    return;
  }
  
  const todo = {
    id: nextId++,
    text: text.trim(),
    completed: false
  };
  
  todos.push(todo);
  renderTodos();
  return todo;
}

function deleteTodo(id) {
  todos = todos.filter(todo => todo.id !== id);
  renderTodos();
}

function toggleTodo(id) {
  const todo = todos.find(todo => todo.id === id);
  if (todo) {
    todo.completed = !todo.completed;
    renderTodos();
  }
}

function renderTodos() {
  const todoList = document.getElementById('todo-list');
  if (!todoList) {
    console.error('Element with id "todo-list" not found');
    return;
  }
  
  todoList.innerHTML = '';
  
  todos.forEach(todo => {
    const todoItem = document.createElement('div');
    todoItem.className = `todo-item ${todo.completed ? 'completed' : ''}`;
    todoItem.innerHTML = `
      <input 
        type="checkbox" 
        ${todo.completed ? 'checked' : ''} 
        onchange="toggleTodo(${todo.id})"
      >
      <span class="todo-text">${todo.text}</span>
      <button onclick="deleteTodo(${todo.id})" class="delete-btn">Delete</button>
    `;
    
    todoList.appendChild(todoItem);
  });
}

function initTodoApp() {
  const addButton = document.getElementById('add-btn');
  const todoInput = document.getElementById('todo-input');
  
  if (addButton && todoInput) {
    addButton.addEventListener('click', () => {
      addTodo(todoInput.value);
      todoInput.value = '';
    });
    
    todoInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        addTodo(todoInput.value);
        todoInput.value = '';
      }
    });
  }
  
  renderTodos();
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', initTodoApp);
}