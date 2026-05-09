// Modularized DELETE /api/collections/:collection_id endpoint for deleting a collection
export function deleteCollectionEndpoint(app, pool) {
  app.delete('/api/collections/:collection_id', async (req, res) => {
    const { collection_id } = req.params;
    try {
      const result = await pool.query(
        `DELETE FROM collections WHERE collection_id = $1 RETURNING *`,
        [collection_id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Collection not found' });
      }
      res.json({ message: 'Collection deleted', collection_id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}
