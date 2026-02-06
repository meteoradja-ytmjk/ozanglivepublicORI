/**
 * Script untuk memverifikasi logika thumbnail rotation
 * Jalankan dengan: node scripts/verify-rotation-logic.js
 */

console.log('='.repeat(60));
console.log('VERIFY THUMBNAIL ROTATION LOGIC');
console.log('='.repeat(60));

// Simulasi dengan 4 thumbnails
const totalThumbnails = 4;

console.log('\n📋 Skenario: 4 thumbnails (#1, #2, #3, #4)');
console.log('   Index:     0,   1,   2,   3');
console.log('-'.repeat(60));

// Test berbagai nilai thumbnail_index dari database
const testCases = [0, 1, 2, 3, 4, 5];

testCases.forEach(dbIndex => {
  const actualNextIndex = dbIndex % totalThumbnails;
  const lastUsedIndex = dbIndex > 0 ? (dbIndex - 1) % totalThumbnails : -1;
  
  console.log(`\n📊 Database thumbnail_index = ${dbIndex}`);
  console.log(`   NEXT akan menggunakan: index ${actualNextIndex} = thumbnail #${actualNextIndex + 1}`);
  if (lastUsedIndex >= 0) {
    console.log(`   SAVED (terakhir digunakan): index ${lastUsedIndex} = thumbnail #${lastUsedIndex + 1}`);
  } else {
    console.log(`   SAVED: (belum ada yang digunakan)`);
  }
  
  // Setelah broadcast dibuat
  const newDbIndex = dbIndex + 1;
  const newActualNextIndex = newDbIndex % totalThumbnails;
  console.log(`   Setelah broadcast dibuat:`);
  console.log(`     Database thumbnail_index = ${newDbIndex}`);
  console.log(`     NEXT berikutnya: index ${newActualNextIndex} = thumbnail #${newActualNextIndex + 1}`);
});

console.log('\n' + '='.repeat(60));
console.log('EXPECTED BEHAVIOR:');
console.log('- Jika DB index = 2, NEXT = #3, SAVED = #2');
console.log('- Setelah broadcast dibuat, DB index = 3, NEXT = #4, SAVED = #3');
console.log('- Jika DB index = 3, NEXT = #4, SAVED = #3');
console.log('- Setelah broadcast dibuat, DB index = 4, NEXT = #1 (wrap), SAVED = #4');
console.log('='.repeat(60));
