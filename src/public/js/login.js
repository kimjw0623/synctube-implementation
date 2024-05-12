// document.addEventListener('DOMContentLoaded', function() {
const loginForm = document.querySelector('form');

loginForm.addEventListener('submit', function(event) {
    event.preventDefault();  // 폼의 기본 제출 동작을 중지

    const userId = loginForm.querySelector('input[name="userId"]').value;
    const password = loginForm.querySelector('input[name="password"]').value;
    console.log(userId, password)
    if (!userId || !password) {
        alert('Please fill in both User ID and Password.');
        return;
    }

    let formData = new FormData();
    formData.append("id",userId)
    formData.append("password", password)
    formData = { "userId": userId, "password": password };
    fetch('/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData),
    }).then(data => {
        console.log('Login successful:', data);
        // 페이지 리다이렉션
        window.location.href = '/';
    }).catch(error => {
        console.error('Login failed:', error);
        alert('Login failed. Please try again.');
    });
});