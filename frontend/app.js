// app.js - Main application logic for the PWA Employee Management App

// --- PouchDB Initialization ---
// Initialize a PouchDB database named 'employees'
// This will create an IndexedDB database in the browser.
const db = new PouchDB('employees');

// --- CouchDB Replication (Conceptual) ---
// IMPORTANT: Replace 'YOUR_COUCHDB_URL' with the actual URL of your CouchDB instance.
// For example: 'http://localhost:5984/myemployees' or a remote CouchDB URL.
// This part is commented out by default because it requires a running CouchDB server.
// If you have a CouchDB server, uncomment this and provide the correct URL.
const remoteCouch = 'http://127.0.0.1:5984/employees'; // e.g., 'http://localhost:5984/myemployees'

// Function to set up replication
function setupReplication() {
    console.log("djfhdjhg")
    if (remoteCouch) {
        const remoteDb = new PouchDB(remoteCouch);
        db.sync(remoteDb, {
            live: true, // Keep replication alive
            retry: true // Retry on failure
        }).on('change', function (info) {
            console.log('Replication change:', info);
            // Data has changed, re-render employees
            loadEmployees();
        }).on('paused', function (err) {
            console.log('Replication paused:', err);
        }).on('active', function () {
            console.log('Replication active.');
        }).on('denied', function (err) {
            console.error('Replication denied:', err);
            showMessage('Error: Replication denied. Check CouchDB permissions.', 'error');
        }).on('complete', function (info) {
            console.log('Replication complete:', info);
        }).on('error', function (err) {
            console.error('Replication error:', err);
            showMessage('Error: Could not connect to CouchDB. Check URL and server status.', 'error');
        });
        console.log('PouchDB replication with CouchDB initiated.');
    } else {
        console.warn('CouchDB URL not set. Replication is disabled.');
        showMessage('CouchDB replication is disabled. Add your CouchDB URL in app.js to enable.', 'warning');
    }
}


// --- DOM Elements ---
const employeeNameInput = document.getElementById('employeeName');
const employeePositionInput = document.getElementById('employeePosition');
const employeeDepartmentInput = document.getElementById('employeeDepartment');
const employeeSalaryInput = document.getElementById('employeeSalary');
const addEmployeeBtn = document.getElementById('addEmployeeBtn');
const employeeList = document.getElementById('employeeList');
const messageBox = document.getElementById('messageBox');

// --- Helper Function for Messages ---
/**
 * Displays a message in the message box.
 * @param {string} message - The message to display.
 * @param {'success'|'error'|'warning'} type - The type of message (for styling).
 */
function showMessage(message, type) {
    messageBox.textContent = message;
    messageBox.className = `mt-6 p-3 rounded-md text-sm text-center ${type}`;
    messageBox.classList.remove('hidden');
    // Hide message after a few seconds
    setTimeout(() => {
        messageBox.classList.add('hidden');
    }, 5000);
}

// --- Employee Item Rendering ---
/**
 * Renders a single employee item to the DOM.
 * @param {object} employee - The employee object from PouchDB.
 */
function renderEmployeeItem(employee) {
    let tr = document.getElementById(employee._id); // Check if row already exists
    if (!tr) {
        tr = document.createElement('tr');
        tr.id = employee._id; // Use PouchDB's _id for the table row ID
        tr.className = 'border-b border-gray-200 hover:bg-gray-50';
        employeeList.prepend(tr); // Add new employees at the top
    } else {
        // Clear existing content if updating
        tr.innerHTML = '';
    }

    // Helper to create editable cell
    const createEditableCell = (field, value, type = 'text') => {
        const td = document.createElement('td');
        td.className = 'py-3 px-6 text-left';
        const span = document.createElement('span');
        span.className = 'editable-field';
        span.textContent = value;
        span.dataset.field = field; // Store the field name for easier update

        span.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = type;
            input.value = span.textContent;
            input.className = 'w-full p-1 border rounded focus:outline-none focus:ring-1 focus:ring-indigo-500';
            if (type === 'number') {
                input.step = '0.01'; // For salary
            }

            // Replace span with input
            td.replaceChild(input, span);
            input.focus();

            const saveChanges = async () => {
                const newValue = input.value.trim();
                if (newValue === '' && field !== 'salary') { // Salary can be 0 or empty, but other fields shouldn't be empty
                    showMessage(`${field} cannot be empty!`, 'error');
                    // Revert to original value if empty
                    td.replaceChild(span, input);
                    return;
                }

                // Only update if value has changed
                if (newValue !== span.textContent) {
                    try {
                        const doc = await db.get(employee._id);
                        doc[field] = (type === 'number') ? parseFloat(newValue) : newValue;
                        await db.put(doc);
                        showMessage(`${field} updated successfully!`, 'success');
                        // PouchDB's changes listener will re-render this item
                    } catch (err) {
                        console.error(`Error updating ${field}:`, err);
                        showMessage(`Failed to update ${field}.`, 'error');
                        // Revert to original value on error
                        td.replaceChild(span, input);
                    }
                } else {
                    // If no change, just revert to span
                    td.replaceChild(span, input);
                }
            };

            input.addEventListener('blur', saveChanges);
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    input.blur(); // Trigger blur to save changes
                }
            });
        });
        td.appendChild(span);
        return td;
    };

    tr.appendChild(createEditableCell('name', employee.name));
    tr.appendChild(createEditableCell('position', employee.position));
    tr.appendChild(createEditableCell('department', employee.department));
    tr.appendChild(createEditableCell('salary', employee.salary.toFixed(2), 'number')); // Format salary

    // Actions cell
    const actionsTd = document.createElement('td');
    actionsTd.className = 'py-3 px-6 text-center';

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn bg-red-500 text-white px-3 py-1 rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition duration-200 ease-in-out';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => deleteEmployee(employee));

    actionsTd.appendChild(deleteBtn);
    tr.appendChild(actionsTd);
}

// --- Employee Operations ---

/**
 * Adds a new employee to PouchDB.
 */
async function addEmployee() {
    const name = employeeNameInput.value.trim();
    const position = employeePositionInput.value.trim();
    const department = employeeDepartmentInput.value.trim();
    const salary = parseFloat(employeeSalaryInput.value.trim());

    if (!name || !position || !department || isNaN(salary) || salary < 0) {
        showMessage('Please fill all fields correctly (Salary must be a positive number).', 'error');
        return;
    }

    const newEmployee = {
        _id: new Date().toISOString(), // Unique ID for PouchDB
        name: name,
        position: position,
        department: department,
        salary: salary,
        createdAt: new Date().toISOString()
    };

    try {
        await db.put(newEmployee);
        showMessage('Employee added successfully!', 'success');
        // Clear input fields
        employeeNameInput.value = '';
        employeePositionInput.value = '';
        employeeDepartmentInput.value = '';
        employeeSalaryInput.value = '';
        
        // PouchDB's changes listener will handle rendering
    } catch (err) {
        console.error('Error adding employee:', err);
        showMessage('Failed to add employee.', 'error');
    }
}

/**
 * Deletes an employee from PouchDB.
 * @param {object} employee - The employee object to delete.
 */
async function deleteEmployee(employee) {
    try {
        // Get the latest revision to delete
        const doc = await db.get(employee._id);
        await db.remove(doc);
        showMessage('Employee deleted successfully!', 'success');
        // PouchDB's changes listener will handle removing from DOM
    } catch (err) {
        console.error('Error deleting employee:', err);
        showMessage('Failed to delete employee.', 'error');
    }
}

/**
 * Loads all employee items from PouchDB and renders them.
 */
async function loadEmployees() {
    try {
        const result = await db.allDocs({
            include_docs: true, // Include the full document
            descending: true // Show newest first
        });
        console.log(result)
        employeeList.innerHTML = ''; // Clear existing list
        if (result.rows.length === 0) {
            employeeList.innerHTML = '<tr><td colspan="5" class="py-4 px-6 text-center text-gray-500">No employees yet! Add one above.</td></tr>';
        } else {
            result.rows.forEach(row => {
                renderEmployeeItem(row.doc);
            });
        }
    } catch (err) {
        console.error('Error loading employees:', err);
        showMessage('Failed to load employees.', 'error');
    }
}

// --- PouchDB Changes Listener ---
// Listen for changes in the database (add, update, delete)
db.changes({
    since: 'now',
    live: true, // Keep the listener alive
    include_docs: true // Include the full document in the change object
}).on('change', function (change) {
    console.log('PouchDB change detected:', change);
    if (change.deleted) {
        // If document was deleted, remove it from the DOM
        const trToRemove = document.getElementById(change.id);
        if (trToRemove) {
            trToRemove.remove();
            if (employeeList.children.length === 0) {
                employeeList.innerHTML = '<tr><td colspan="5" class="py-4 px-6 text-center text-gray-500">No employees yet! Add one above.</td></tr>';
            }
        }
    } else {
        // If document was added or updated, render/re-render it
        renderEmployeeItem(change.doc);
    }
}).on('error', function (err) {
    console.error('PouchDB changes error:', err);
    showMessage('Error listening to database changes.', 'error');
});

// --- Event Listeners ---
addEmployeeBtn.addEventListener('click', addEmployee);
// Allow adding employee by pressing Enter in any input field
[employeeNameInput, employeePositionInput, employeeDepartmentInput, employeeSalaryInput].forEach(input => {
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addEmployee();
        }
    });
});

// --- Service Worker Registration ---
// Check if service workers are supported by the browser
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/frontend/sw.js')
            .then(registration => {
                console.log('Service Worker registered with scope:', registration.scope);
                showMessage('App is ready for offline use!', 'success');
            })
            .catch(error => {
                console.error('Service Worker registration failed:', error);
                showMessage('Offline features may not be available.', 'error');
            });
    });
} else {
    console.warn('Service Workers are not supported in this browser.');
    showMessage('Your browser does not support offline features.', 'warning');
}

// --- Initial Load ---
document.addEventListener('DOMContentLoaded', function() {
  setupReplication();
 loadEmployees();
});
