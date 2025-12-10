import { createServer } from 'https';
import { parse } from 'url';
import next from 'next';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { execSync } from 'child_process';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = 3000;

// Initialize Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // Check if certificates exist, if not create them
  const certDir = path.join(__dirname, 'certificates');
  const keyPath = path.join(certDir, 'localhost-key.pem');
  const certPath = path.join(certDir, 'localhost.pem');

  let httpsOptions;

  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    // Use existing certificates
    httpsOptions = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    };
    console.log('✓ Using existing SSL certificates');
  } else {
    // Create self-signed certificates
    console.log(
      '⚠ SSL certificates not found. Creating self-signed certificates...'
    );

    // Create certificates directory
    if (!fs.existsSync(certDir)) {
      fs.mkdirSync(certDir, { recursive: true });
    }

    try {
      // Generate self-signed certificate using openssl
      execSync(
        `openssl req -x509 -newkey rsa:2048 -nodes -sha256 -subj '/CN=localhost' \
        -keyout ${keyPath} -out ${certPath} -days 365`,
        { stdio: 'inherit' }
      );

      httpsOptions = {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
      };
      console.log('✓ Self-signed SSL certificates created successfully');
      console.log(
        '⚠ Note: Your browser will show a security warning. This is normal for self-signed certificates.'
      );
      console.log(
        '   Click "Advanced" and "Proceed to localhost" to continue.'
      );
    } catch (error) {
      console.error('✗ Failed to generate SSL certificates:', error.message);
      console.error('\nPlease ensure OpenSSL is installed on your system.');
      console.error(
        'Alternatively, manually create certificates in the ./certificates directory.'
      );
      process.exit(1);
    }
  }

  // Create HTTPS server
  createServer(httpsOptions, async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  })
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`\n🔒 HTTPS Server running at https://${hostname}:${port}`);
      console.log(`   Ready for development with secure connections\n`);
    });
});
