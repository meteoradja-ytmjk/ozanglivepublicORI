// Test script to check if routes work
const express = require('express');

async function testRoutes() {
  try {
    // Test database
    const { db, waitForDbInit } = require('./db/database');
    console.log('Database module loaded');
    
    await waitForDbInit();
    console.log('Database initialized');
    
    // Test User model
    const User = require('./models/User');
    console.log('User model loaded');
    
    const users = await User.findAll();
    console.log('Users found:', users.length);
    
    // Test Video model
    const Video = require('./models/Video');
    console.log('Video model loaded');
    
    // Test Audio model
    const Audio = require('./models/Audio');
    console.log('Audio model loaded');
    
    // Test Playlist model
    const Playlist = require('./models/Playlist');
    console.log('Playlist model loaded');
    
    console.log('\nAll models loaded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testRoutes();
