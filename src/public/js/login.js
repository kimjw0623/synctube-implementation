
const loginForm = document.querySelector('form');

loginForm.addEventListener('submit', function(event) {
    event.preventDefault();

    const userId = loginForm.querySelector('input[name="userId"]').value;
    const password = loginForm.querySelector('input[name="inputPassword"]').value;
    console.log(userId, password)
    if (!userId || !password) {
        alert('Please fill in both User ID and Password.');
        return;
    }

    const formData = { "userId": userId, "password": password };
    fetch('/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData),
    }).then(data => {
        console.log('Login successful:', data);
        // Page redirection
        window.location.href = '/';
    }).catch(error => {
        console.error('Login failed:', error);
        alert('Login failed. Please try again.');
    });
});