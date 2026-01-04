// After insert:
await pool.query('INSERT INTO schedule_items (user_id, data) VALUES (?, ?)', [req.user.id, encrypted]);
// return created task payload to client
res.json({ success: true, created: task });