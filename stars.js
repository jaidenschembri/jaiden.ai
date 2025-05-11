const canvas = document.getElementById('starfield');
const ctx = canvas.getContext('2d');

const VIRTUAL_WIDTH = 1920;
const VIRTUAL_HEIGHT = 1080;
const STAR_COUNT = 350;
const SHOOTING_STAR_CHANCE = 0.001; // reduced frequency

let stars = [];
let shootingStars = [];

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function initStars() {
  stars = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    stars.push({
      x: Math.random() * VIRTUAL_WIDTH,
      y: Math.random() * VIRTUAL_HEIGHT,
      z: Math.random() * VIRTUAL_WIDTH,
      radius: Math.random() * 0.8 + 0.1,
      twinklePhase: Math.random() * Math.PI * 2
    });
  }
}

function drawStars(time) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const scaleX = canvas.width / VIRTUAL_WIDTH;
  const scaleY = canvas.height / VIRTUAL_HEIGHT;

  for (let s of stars) {
    const perspective = VIRTUAL_WIDTH / s.z;
    const x = (s.x - VIRTUAL_WIDTH / 2) * perspective * scaleX + canvas.width / 2;
    const y = (s.y - VIRTUAL_HEIGHT / 2) * perspective * scaleY + canvas.height / 2;
    const radius = s.radius * perspective * ((scaleX + scaleY) / 2);
    const twinkle = 0.1 + 0.5 * Math.abs(Math.sin(time * 0.001 + s.twinklePhase));

    ctx.beginPath();
    ctx.globalAlpha = twinkle;
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ffffff';
    ctx.fillStyle = '#ffffff';
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }
}

function spawnShootingStar() {
  shootingStars.push({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height * 0.5,
    vx: Math.random() * 8 + 4,
    vy: Math.random() * 2 + 1,
    length: Math.random() * 80 + 60,
    alpha: 1
  });
}

function drawShootingStars() {
  for (let s of shootingStars) {
    ctx.beginPath();
    const gradient = ctx.createLinearGradient(s.x, s.y, s.x - s.length, s.y - s.length * 0.25);
    gradient.addColorStop(0, `rgba(255,255,255,${s.alpha})`);
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2;
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x - s.length, s.y - s.length * 0.25);
    ctx.stroke();

    s.x += s.vx;
    s.y += s.vy;
    s.alpha -= 0.01;
  }

  shootingStars = shootingStars.filter(s => s.alpha > 0);
}

function animate(time = 0) {
  for (let s of stars) {
    s.z -= 0.2;
    if (s.z <= 1) {
      s.z = VIRTUAL_WIDTH;
      s.x = Math.random() * VIRTUAL_WIDTH;
      s.y = Math.random() * VIRTUAL_HEIGHT;
    }
  }

  if (Math.random() < SHOOTING_STAR_CHANCE) {
    spawnShootingStar();
  }

  drawStars(time);
  drawShootingStars();
  requestAnimationFrame(animate);
}

window.addEventListener('resize', () => {
  resizeCanvas();
  initStars();
});

resizeCanvas();
initStars();
animate();
