/* Solo mejora la lectura; todo el contenido y las imágenes están en index.html. */
(() => {
  'use strict';

  const chapters = [...document.querySelectorAll('main > .content > .chapter')];
  const navLinks = [...document.querySelectorAll('.chapter-nav a')];
  const mobileNav = document.querySelector('#chapter-select');
  const progress = document.querySelector('#reading-progress');
  const progressLabel = document.querySelector('#reading-label');
  const routeLinks = [...document.querySelectorAll('.route a')];
  const routeGroup = {
    'primeros-pasos': 'primeros-pasos', proyectos: 'proyectos', editor: 'editor',
    colaboracion: 'colaboracion', intercambio: 'intercambio', bocetos: 'intercambio',
    springboot: 'intercambio', agente: 'agente', chat: 'agente', versiones: 'versiones',
    problemas: 'versiones', glosario: 'versiones',
  };
  let framePending = false;

  function updateReading() {
    const offset = window.innerWidth <= 900 ? 150 : 110;
    let current = null;
    for (const chapter of chapters) {
      if (chapter.getBoundingClientRect().top <= offset) current = chapter;
    }
    const atBottom = Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight - 2;
    if (atBottom) current = chapters[chapters.length - 1];
    const index = current ? chapters.indexOf(current) + 1 : 0;
    navLinks.forEach((link) => {
      if (link.hash === `#${current?.id}`) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    mobileNav.value = current?.id ?? 'portada';
    progress.value = index;
    progressLabel.textContent = index ? `${index} de ${chapters.length}` : 'Por comenzar';
    routeLinks.forEach((link) => link.classList.toggle('is-current', link.hash === `#${routeGroup[current?.id]}`));
    framePending = false;
  }

  function requestReadingUpdate() {
    if (framePending) return;
    framePending = true;
    window.requestAnimationFrame(updateReading);
  }

  mobileNav.addEventListener('change', () => {
    const target = document.getElementById(mobileNav.value);
    if (target) {
      target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
      history.replaceState(null, '', `#${target.id}`);
    }
  });
  window.addEventListener('scroll', requestReadingUpdate, { passive: true });
  window.addEventListener('resize', requestReadingUpdate);
  window.addEventListener('load', updateReading);
  updateReading();

  // Enlace de imagen sin JS; con JS, ampliación accesible mediante <dialog>.
  const lightbox = document.querySelector('#capture-lightbox');
  const expandedImage = lightbox.querySelector('img');
  const expandedCaption = lightbox.querySelector('#lightbox-caption');
  const originalLink = lightbox.querySelector('.lightbox-original');
  let opener = null;

  document.querySelectorAll('.capture-link').forEach((link) => {
    link.addEventListener('click', (event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || typeof lightbox.showModal !== 'function') return;
      event.preventDefault();
      opener = link;
      expandedImage.src = link.href;
      expandedImage.alt = link.querySelector('img').alt;
      expandedCaption.textContent = link.closest('figure').querySelector('figcaption strong').textContent;
      originalLink.href = link.href;
      lightbox.showModal();
      document.body.classList.add('lightbox-open');
    });
  });
  lightbox.querySelector('.lightbox-close').addEventListener('click', () => lightbox.close());
  lightbox.addEventListener('click', (event) => {
    const bounds = lightbox.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) lightbox.close();
  });
  lightbox.addEventListener('close', () => {
    document.body.classList.remove('lightbox-open');
    opener?.focus({ preventScroll: true });
    expandedImage.removeAttribute('src');
  });

  // La impresión incluye también las acciones adicionales y las preguntas frecuentes.
  let closedBeforePrint = [];
  let printPrepared = false;
  function preparePrint() {
    if (printPrepared) return;
    printPrepared = true;
    if (lightbox.open) lightbox.close();
    closedBeforePrint = [...document.querySelectorAll('details:not([open])')];
    closedBeforePrint.forEach((details) => { details.open = true; });
  }
  window.addEventListener('beforeprint', preparePrint);
  window.addEventListener('afterprint', () => {
    closedBeforePrint.forEach((details) => { details.open = false; });
    closedBeforePrint = [];
    printPrepared = false;
  });
  document.querySelector('#print-manual').addEventListener('click', () => window.print());
})();
