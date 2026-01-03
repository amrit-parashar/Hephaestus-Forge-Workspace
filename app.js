const supabaseUrl = 'https://pkktiavfwufuiunxllux.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBra3RpYXZmd3VmdWl1bnhsbHV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0NDYyOTQsImV4cCI6MjA4MzAyMjI5NH0.5fEWMjqebQ41fVf0jpt5IIPb5cYo9xEaqBqDHC-VPko';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);
const tabs = document.querySelectorAll('.tab');

lucide.createIcons();

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const type = tab.innerText.toLowerCase().includes('sign') ? 'signup' : 'login';
        toggleForm(type);
        
    });
});

function toggleForm(type) {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    
    if (type === 'signup') {
        loginForm.style.display = 'none';
        signupForm.style.display = 'block';
    } else {
        loginForm.style.display = 'block';
        signupForm.style.display = 'none';
    }
}
async function signUpUser(email, password, fullName) {
    const { data, error } = await supabaseClient.auth.signUp({
        email: email,
        password: password,
        options: {
            data: {
                full_name: fullName 
            }
        }
    });

    if (error) {
        alert("Forge Error: " + error.message);
    } else {
        alert("Verification email sent! Check your scrolls.");
        document.getElementById('signup-form').reset();
    }
}

async function loginUser(email, password) {
    const loginBtn = document.getElementById('login-btn');
    const btnText = loginBtn.querySelector('.btn-text');
    const spinner = loginBtn.querySelector('.spinner');

    loginBtn.classList.add('btn-loading');
    spinner.classList.remove('hidden');
    btnText.innerText = "Forging...";

    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
    });

    loginBtn.classList.remove('btn-loading');
    spinner.classList.add('hidden');
    btnText.innerText = "Unlock";

    

    if (error) {
        alert("Access Denied: " + error.message);
        document.getElementById('login-form').reset();
    } else {
        document.getElementById('login-form').reset();
        
        // Success! Redirect to the main workspace
        window.location.href = '/workspace.html';
    }
}

document.querySelector('#signup-form .btn-unlock').addEventListener('click', (e) => {
    e.preventDefault();
    const email = document.querySelector('#signup-form input[type="email"]').value;
    const password = document.querySelector('#signup-form input[type="password"]').value;
    const name = document.querySelector('#signup-form input[type="text"]').value;
    
    signUpUser(email, password, name);
});

document.querySelector('#login-form .btn-unlock').addEventListener('click', (e) => {
    e.preventDefault();
    const email = document.querySelector('#login-form input[type="email"]').value;
    const password = document.querySelector('#login-form input[type="password"]').value;
    
    loginUser(email, password);
});
