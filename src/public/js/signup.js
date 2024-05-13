
const loginForm = document.querySelector('form');

loginForm.addEventListener('submit', function(event) {
    event.preventDefault();  // 폼의 기본 제출 동작을 중지

    const userId = loginForm.querySelector('input[name="userId"]').value;
    const nickname = loginForm.querySelector('input[name="nickname"]').value;
    const password = loginForm.querySelector('input[name="inputPassword"]').value;
    console.log(userId, password, nickname)
    if (!userId || !password || !nickname) {
        alert('Please fill in both User ID and Password.');
        return;
    }

    let formData = new FormData();
    formData.append("id",userId)
    formData.append("password", password)
    formData = { "userId": userId, "password": password, "nickname": nickname };
    fetch('/signup', {
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