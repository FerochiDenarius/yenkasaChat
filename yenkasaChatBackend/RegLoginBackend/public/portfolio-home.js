const year = document.getElementById('year');

if (year) {
  year.textContent = new Date().getFullYear();
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, function replaceChar(char) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char];
  });
}

function mediaMarkup(product) {
  const screenshots = Array.isArray(product.screenshots) ? product.screenshots.filter((item) => item && (item.src || item.url)) : [];
  const videos = Array.isArray(product.videos) ? product.videos.filter((item) => item && (item.src || item.url)) : [];
  const items = screenshots.slice(0, 2).map((item) => ({
    type: 'image',
    title: item.title || product.name,
    src: item.src || item.url,
  })).concat(videos.slice(0, 1).map((item) => ({
    type: 'video',
    title: item.title || product.name,
    src: item.src || item.url,
  })));

  if (!items.length) return '';
  return '<div class="media-gallery">' + items.map((item) => {
    if (item.type === 'video') {
      return '<figure class="media-tile"><video controls muted playsinline src="' + escapeHtml(item.src) + '" title="' + escapeHtml(item.title) + '"></video><figcaption>' + escapeHtml(item.title) + '</figcaption></figure>';
    }
    return '<figure class="media-tile"><img src="' + escapeHtml(item.src) + '" alt="' + escapeHtml(item.title) + '" loading="lazy"><figcaption>' + escapeHtml(item.title) + '</figcaption></figure>';
  }).join('') + '</div>';
}

function paragraphMarkup(value) {
  return String(value || '')
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => '<p>' + escapeHtml(part) + '</p>')
    .join('');
}

function teamMarkup(member) {
  const photo = member.photo || '/images/default.png';
  return '<article class="team-card">' +
    '<div class="team-photo"><img src="' + escapeHtml(photo) + '" alt="' + escapeHtml(member.name || 'Team member') + '" loading="lazy" /></div>' +
    '<div class="team-body">' +
      '<p class="team-role">' + escapeHtml(member.role || 'Team Member') + '</p>' +
      '<h3>' + escapeHtml(member.name || 'Team Member') + '</h3>' +
      '<dl>' +
        '<div><dt>Background</dt><dd>' + escapeHtml(member.background || '') + '</dd></div>' +
        '<div><dt>Field of Study</dt><dd>' + escapeHtml(member.fieldOfStudy || '') + '</dd></div>' +
        '<div><dt>Major</dt><dd>' + escapeHtml(member.major || '') + '</dd></div>' +
      '</dl>' +
    '</div>' +
  '</article>';
}

async function hydratePortfolioProducts() {
  const cards = Array.from(document.querySelectorAll('[data-product-card]'));
  const teamGrid = document.querySelector('.team-grid');
  if (!cards.length && !teamGrid) return;

  try {
    const response = await fetch('/api/portfolio/content');
    const payload = await response.json();
    if (!response.ok || !payload.success) return;
    const products = new Map((payload.content?.products || []).map((product) => [product.id, product]));

    cards.forEach((card) => {
      const product = products.get(card.dataset.productCard);
      if (!product) return;
      const title = card.querySelector('h3');
      const description = card.querySelector('p');
      const media = card.querySelector('[data-product-media]');
      if (title && product.name) title.textContent = product.name;
      if (description && product.description) description.outerHTML = '<div class="product-description">' + paragraphMarkup(product.description) + '</div>';
      if (media) media.innerHTML = mediaMarkup(product);
    });

    if (teamGrid && Array.isArray(payload.content?.teamMembers) && payload.content.teamMembers.length) {
      teamGrid.innerHTML = payload.content.teamMembers.map(teamMarkup).join('');
    }
  } catch (error) {
    // Static content remains available if the portfolio API is temporarily unavailable.
  }
}

hydratePortfolioProducts();
