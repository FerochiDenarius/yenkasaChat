const fs = require('fs');
const path = require('path');

function createBlogService(rootDir) {
  const blogDir = path.join(rootDir, 'public', 'blog');
  const blogPostsDir = path.join(blogDir, 'posts');
  const blogEngagementDir = path.join(rootDir, 'data');
  const blogEngagementPath = path.join(blogEngagementDir, 'blog-engagement.json');

  function isValidBlogSlug(slug) {
    return /^[a-z0-9-]+$/i.test(String(slug || ''));
  }

  function readBlogEngagement() {
    try {
      if (!fs.existsSync(blogEngagementPath)) return {};
      return JSON.parse(fs.readFileSync(blogEngagementPath, 'utf8'));
    } catch (err) {
      console.error('Failed to read blog engagement data:', err.message);
      return {};
    }
  }

  function writeBlogEngagement(data) {
    fs.mkdirSync(blogEngagementDir, { recursive: true });
    fs.writeFileSync(blogEngagementPath, JSON.stringify(data, null, 2));
  }

  function getBlogEngagementRecord(slug) {
    const data = readBlogEngagement();
    if (!data[slug]) {
      data[slug] = { slug, views: 0, likes: 0 };
    }
    return { data, record: data[slug] };
  }

  function registerBlogRoutes(app) {
    app.get('/blog', (req, res) => {
      res.sendFile(path.join(blogDir, 'index.html'));
    });

    app.get('/api/blog/:slug/views', (req, res) => {
      const slug = String(req.params.slug || '');
      if (!isValidBlogSlug(slug)) return res.status(400).json({ message: 'Invalid blog slug' });

      const { record } = getBlogEngagementRecord(slug);
      return res.json({ slug, views: record.views || 0 });
    });

    app.post('/api/blog/:slug/view', (req, res) => {
      const slug = String(req.params.slug || '');
      if (!isValidBlogSlug(slug)) return res.status(400).json({ message: 'Invalid blog slug' });

      const { data, record } = getBlogEngagementRecord(slug);
      record.views = Number(record.views || 0) + 1;
      writeBlogEngagement(data);
      return res.json({ slug, views: record.views });
    });

    app.get('/api/blog/:slug/likes', (req, res) => {
      const slug = String(req.params.slug || '');
      if (!isValidBlogSlug(slug)) return res.status(400).json({ message: 'Invalid blog slug' });

      const { record } = getBlogEngagementRecord(slug);
      return res.json({ slug, likes: record.likes || 0 });
    });

    app.post('/api/blog/:slug/like', (req, res) => {
      const slug = String(req.params.slug || '');
      if (!isValidBlogSlug(slug)) return res.status(400).json({ message: 'Invalid blog slug' });

      const { data, record } = getBlogEngagementRecord(slug);
      record.likes = Number(record.likes || 0) + 1;
      writeBlogEngagement(data);
      return res.json({ slug, likes: record.likes });
    });

    app.get('/blog/:slug', (req, res, next) => {
      const slug = String(req.params.slug || '');
      if (!isValidBlogSlug(slug)) return next();

      const filePath = path.join(blogPostsDir, `${slug}.html`);
      return res.sendFile(filePath, (err) => {
        if (err) next();
      });
    });
  }

  return {
    registerBlogRoutes,
  };
}

module.exports = createBlogService;
