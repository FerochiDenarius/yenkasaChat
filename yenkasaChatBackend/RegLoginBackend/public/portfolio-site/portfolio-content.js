(function () {
  const productId = window.YENKASA_PORTFOLIO_PRODUCT;
  if (!productId) return;

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char]));
  }

  function mediaTile(item, type) {
    const title = escapeHtml(item.title || 'Portfolio media');
    const src = escapeHtml(item.src || item.url || '');
    if (!src) return '';
    if (type === 'videos') {
      return `<article class="media-tile"><video src="${src}" controls preload="metadata"></video><span>${title}</span></article>`;
    }
    return `<article class="media-tile"><img src="${src}" alt="${title}" loading="lazy" /><span>${title}</span></article>`;
  }

  async function loadPortfolioContent() {
    try {
      const response = await fetch('/api/portfolio/content');
      const payload = await response.json();
      if (!response.ok || !payload.success) return;
      const product = (payload.content?.products || []).find((item) => item.id === productId);
      if (!product) return;

      const gallery = document.querySelector('#gallery .media-grid');
      const media = [
        ...(product.screenshots || []).map((item) => mediaTile(item, 'screenshots')),
        ...(product.videos || []).map((item) => mediaTile(item, 'videos')),
      ].filter(Boolean);
      if (gallery && media.length) {
        gallery.innerHTML = media.join('');
      }

      const status = document.querySelector('[data-portfolio-status]');
      if (status && product.status) status.textContent = product.status;

      const description = document.querySelector('[data-portfolio-description]');
      if (description && product.description) description.textContent = product.description;
    } catch (error) {
      // Keep static fallback content if Firestore content is unavailable.
    }
  }

  loadPortfolioContent();
}());
