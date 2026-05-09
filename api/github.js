export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  const GITHUB_TOKEN = process.env.GH_TOKEN;
  const REPO = 'n4taza/web-app';
  const BRANCH = 'main';
  const BASE_API = `https://api.github.com/repos/${REPO}/contents`;
  
  if (!GITHUB_TOKEN) {
    return res.status(500).json({ success: false, error: 'GH_TOKEN environment variable not set' });
  }
  
  const { endpoint } = req.query;
  if (!endpoint) {
    return res.status(400).json({ success: false, error: 'Missing endpoint parameter' });
  }
  
  const filePath = endpoint;
  const url = `${BASE_API}/${filePath}?ref=${BRANCH}`;
  
  try {
    if (req.method === 'GET') {
      // Ambil file dari GitHub
      const response = await fetch(url, {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      
      if (!response.ok) {
        // File mungkin belum ada, return array kosong
        if (response.status === 404) {
          return res.status(200).json({ success: true, data: [] });
        }
        return res.status(response.status).json({ success: false, error: 'Failed to fetch file' });
      }
      
      const data = await response.json();
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      const jsonData = JSON.parse(content);
      
      return res.status(200).json({ success: true, data: jsonData, sha: data.sha });
      
    } else if (req.method === 'PUT') {
      // Simpan file ke GitHub
      const { data: newData, message } = req.body;
      
      // Ambil file yang ada untuk mendapatkan SHA
      const getResponse = await fetch(url, {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      
      let sha = null;
      if (getResponse.ok) {
        const existing = await getResponse.json();
        sha = existing.sha;
      }
      
      const content = Buffer.from(JSON.stringify(newData, null, 2)).toString('base64');
      const putResponse = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github.v3+json'
        },
        body: JSON.stringify({
          message: message || `Update ${filePath}`,
          content: content,
          sha: sha,
          branch: BRANCH
        })
      });
      
      if (!putResponse.ok) {
        const error = await putResponse.text();
        return res.status(putResponse.status).json({ success: false, error: error });
      }
      
      return res.status(200).json({ success: true });
    } else {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
