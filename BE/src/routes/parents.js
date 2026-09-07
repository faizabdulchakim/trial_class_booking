const express = require('express');
const router = express.Router();
const prisma = require('../db');

// GET /api/parents - List parents and their registered children
router.get('/', async (req, res) => {
  try {
    const parents = await prisma.parent.findMany({
      include: {
        students: true
      },
      orderBy: { name: 'asc' }
    });

    res.json({ success: true, data: parents });
  } catch (error) {
    console.error('Error fetching parents:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch parents.' });
  }
});

// GET /api/parents/:id/students - Get children of a specific parent
router.get('/:id/students', async (req, res) => {
  try {
    const { id } = req.params;
    const students = await prisma.student.findMany({
      where: { parentId: id },
      orderBy: { name: 'asc' }
    });

    res.json({ success: true, data: students });
  } catch (error) {
    console.error('Error fetching parent students:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch students.' });
  }
});

module.exports = router;
