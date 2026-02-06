/**
 * Fresh Install Script
 * Menghapus semua data dan file yang ada untuk instalasi ulang
 * 
 * PERINGATAN: Script ini akan menghapus SEMUA data!
 * - Database (users, videos, audios, streams, dll)
 * - File uploads (videos, audios, thumbnails, avatars)
 * - Session data
 * 
 * Jalankan dengan: node scripts/fresh-install.js
 */

const fs = require('fs-extra');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Paths to delete
const pathsToDelete = [
  // Database files
  'db/streamflow.db',
  'db/streamflow.db-shm',
  'db/streamflow.db-wal',
  'db/sessions.db',
  'db/ozanglive.db',
  
  // Upload directories (contents only, keep folders)
  'public/uploads/videos',
  'public/uploads/audios',
  'public/uploads/thumbnails',
  'public/uploads/avatars',
  
  // Log files
  'logs/app.log',
  'logs/pm2-combined.log',
  'logs/pm2-error.log',
  'logs/pm2-out.log'
];

// Directories to recreate (empty)
const dirsToRecreate = [
  'public/uploads/videos',
  'public/uploads/audios',
  'public/uploads/thumbnails',
  'public/uploads/avatars',
  'logs',
  'db'
];

async function confirmAction() {
  return new Promise((resolve) => {
    console.log('\n⚠️  PERINGATAN: Script ini akan menghapus SEMUA data!\n');
    console.log('Yang akan dihapus:');
    console.log('  - Database (semua users, videos, streams, settings)');
    console.log('  - Semua file video yang diupload');
    console.log('  - Semua file audio yang diupload');
    console.log('  - Semua thumbnail');
    console.log('  - Semua avatar');
    console.log('  - Log files');
    console.log('');
    
    rl.question('Ketik "HAPUS SEMUA" untuk melanjutkan: ', (answer) => {
      resolve(answer === 'HAPUS SEMUA');
    });
  });
}

async function deletePathSafely(targetPath) {
  const fullPath = path.join(process.cwd(), targetPath);
  
  try {
    if (await fs.pathExists(fullPath)) {
      const stats = await fs.stat(fullPath);
      
      if (stats.isDirectory()) {
        // Delete directory contents
        await fs.emptyDir(fullPath);
        console.log(`  ✓ Dikosongkan: ${targetPath}`);
      } else {
        // Delete file
        await fs.remove(fullPath);
        console.log(`  ✓ Dihapus: ${targetPath}`);
      }
    } else {
      console.log(`  - Tidak ada: ${targetPath}`);
    }
  } catch (error) {
    console.error(`  ✗ Gagal: ${targetPath} - ${error.message}`);
  }
}

async function ensureDirectory(dirPath) {
  const fullPath = path.join(process.cwd(), dirPath);
  
  try {
    await fs.ensureDir(fullPath);
    console.log(`  ✓ Dibuat: ${dirPath}`);
  } catch (error) {
    console.error(`  ✗ Gagal membuat: ${dirPath} - ${error.message}`);
  }
}

async function createGitkeepFiles() {
  const gitkeepDirs = [
    'public/uploads/videos',
    'public/uploads/audios',
    'public/uploads/thumbnails',
    'public/uploads/avatars',
    'logs',
    'db'
  ];
  
  for (const dir of gitkeepDirs) {
    const gitkeepPath = path.join(process.cwd(), dir, '.gitkeep');
    try {
      await fs.writeFile(gitkeepPath, '');
    } catch (error) {
      // Ignore errors
    }
  }
}

async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║     STREAMFLOW FRESH INSTALL SCRIPT    ║');
  console.log('╚════════════════════════════════════════╝');
  
  const confirmed = await confirmAction();
  
  if (!confirmed) {
    console.log('\n❌ Dibatalkan. Tidak ada yang dihapus.\n');
    rl.close();
    process.exit(0);
  }
  
  console.log('\n🗑️  Menghapus data...\n');
  
  // Delete all paths
  for (const targetPath of pathsToDelete) {
    await deletePathSafely(targetPath);
  }
  
  console.log('\n📁 Membuat direktori...\n');
  
  // Recreate directories
  for (const dir of dirsToRecreate) {
    await ensureDirectory(dir);
  }
  
  // Create .gitkeep files
  await createGitkeepFiles();
  
  console.log('\n✅ Fresh install selesai!\n');
  console.log('Langkah selanjutnya:');
  console.log('  1. Jalankan: npm start');
  console.log('  2. Buka browser: http://localhost:3000');
  console.log('  3. Buat akun admin baru\n');
  
  rl.close();
  process.exit(0);
}

main().catch((error) => {
  console.error('Error:', error);
  rl.close();
  process.exit(1);
});
