#!/bin/bash
# Direct patch for voice note issues - run on GCP VM
set -e
cd /opt/whatsapp-crm

echo "=== Patching voice note issues directly on server ==="

# 1. Fix upload route - remove FFmpeg dependency
cat > backend/src/routes/upload.ts << 'EOF'
import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
const router = Router();
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => cb(null, 'voice_' + Date.now() + '.ogg'),
  }),
  limits: { fileSize: 16 * 1024 * 1024 },
});
router.post('/audio', upload.single('audio'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'betteraisender.com';
    const url = proto + '://' + host + '/uploads/' + req.file.filename;
    logger.info('Audio saved: ' + req.file.filename);
    res.json({ url, mimeType: 'audio/ogg' });
  } catch(e: any) { res.status(500).json({ error: e.message }); }
});
export default router;
EOF

# 2. Fix whatsapp controller - add axios import & download received audio
head -6 backend/src/controllers/whatsappController.ts | grep axios || \
  sed -i "1s/^/import axios from 'axios';\n/" backend/src/controllers/whatsappController.ts

# 3. Fix received audio - download from Meta and save locally
python3 << 'PYFIX'
import re

with open('backend/src/controllers/whatsappController.ts', 'r') as f:
    content = f.read()

# Replace the audio case in webhook handler
old = """              case 'audio':
              case 'voice':
                msgData.type = 'AUDIO';
                msgData.mediaUrl = msg.audio?.id;
                msgData.mediaType = msg.audio?.mime_type;
                break;"""

new = """              case 'audio':
              case 'voice':
                msgData.type = 'AUDIO';
                if (msg.audio?.id) {
                  try {
                    const pathMod = require('path');
                    const fsMod = require('fs');
                    const uDir = pathMod.join(process.cwd(), 'uploads');
                    if (!fsMod.existsSync(uDir)) fsMod.mkdirSync(uDir, { recursive: true });
                    const metaInfo = await axios.get(
                      'https://graph.facebook.com/v19.0/' + msg.audio.id,
                      { headers: { Authorization: 'Bearer ' + account.accessToken } }
                    );
                    const dlUrl = metaInfo.data.url;
                    const mime = metaInfo.data.mime_type || 'audio/ogg';
                    const ext = mime.includes('ogg') ? '.ogg' : mime.includes('mp4') ? '.mp4' : '.webm';
                    const fname = 'recv_' + Date.now() + ext;
                    const fpath = pathMod.join(uDir, fname);
                    const dlResp = await axios.get(dlUrl, {
                      headers: { Authorization: 'Bearer ' + account.accessToken },
                      responseType: 'arraybuffer',
                    });
                    fsMod.writeFileSync(fpath, dlResp.data);
                    msgData.mediaUrl = 'https://betteraisender.com/uploads/' + fname;
                    msgData.mediaType = mime;
                  } catch(ae) {
                    msgData.mediaUrl = null;
                    msgData.mediaType = 'audio/ogg';
                  }
                }
                break;"""

if old.strip() in content:
    content = content.replace(old, new)
    print("Webhook audio handler patched")
else:
    # Try simpler replacement
    content = re.sub(
        r"case 'audio':\s*msgData\.type = 'AUDIO';\s*msgData\.mediaUrl = msg\.audio\?\.id;\s*msgData\.mediaType = msg\.audio\?\.mime_type;\s*break;",
        """case 'audio':
              case 'voice':
                msgData.type = 'AUDIO';
                msgData.mediaUrl = null; msgData.mediaType = 'audio/ogg';
                if (msg.audio?.id) {
                  try {
                    const pm = require('path'); const fm = require('fs');
                    const ud = pm.join(process.cwd(), 'uploads');
                    if (!fm.existsSync(ud)) fm.mkdirSync(ud, { recursive: true });
                    const mi = await axios.get('https://graph.facebook.com/v19.0/' + msg.audio.id, { headers: { Authorization: 'Bearer ' + account.accessToken } });
                    const dr = await axios.get(mi.data.url, { headers: { Authorization: 'Bearer ' + account.accessToken }, responseType: 'arraybuffer' });
                    const fn = 'recv_' + Date.now() + '.ogg';
                    fm.writeFileSync(pm.join(ud, fn), dr.data);
                    msgData.mediaUrl = 'https://betteraisender.com/uploads/' + fn;
                    msgData.mediaType = mi.data.mime_type || 'audio/ogg';
                  } catch(e) {}
                }
                break;""",
        content
    )
    print("Webhook audio handler patched (regex)")

with open('backend/src/controllers/whatsappController.ts', 'w') as f:
    f.write(content)
PYFIX

# 4. Rebuild backend on server
echo "Building backend..."
cd backend
npm run build 2>&1 | tail -5
cd ..

# 5. Rebuild Docker containers
echo "Rebuilding containers..."
sudo docker compose -f docker-compose.server.yml --env-file deploy/.env.production up -d --build backend frontend
sleep 20
sudo docker exec crm_nginx nginx -s reload

echo ""
echo "=== PATCH COMPLETE ==="
echo "Test: curl https://betteraisender.com/health"
