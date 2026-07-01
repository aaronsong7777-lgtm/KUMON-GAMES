var heading = document.querySelector('h1');
var year = document.querySelector('#year');
var navLinks = document.querySelectorAll('.site-nav a');
var sections = document.querySelectorAll('main section[id]');
var skillButtons = document.querySelectorAll('.skill-list button');

heading.addEventListener('mouseenter', function () {
    this.style.color = '#ff6b6b';
});

heading.addEventListener('mouseout', function () {
    this.style.color = '';
});

year.textContent = new Date().getFullYear();

document.addEventListener('click', function (event) {
    var sparkle = document.createElement('span');
    sparkle.className = 'sparkle';
    sparkle.style.left = event.clientX + 'px';
    sparkle.style.top = event.clientY + 'px';
    document.body.appendChild(sparkle);
    window.setTimeout(function () {
        sparkle.remove();
    }, 650);
});

skillButtons.forEach(function (button) {
    button.addEventListener('click', function () {
        this.classList.toggle('selected');
    });
});

window.addEventListener('scroll', function () {
    var current = '';

    sections.forEach(function (section) {
        if (window.scrollY >= section.offsetTop - 140) {
            current = section.id;
        }
    });

    navLinks.forEach(function (link) {
        link.classList.toggle('active', link.getAttribute('href') === '#' + current);
    });
});
