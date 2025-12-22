import Mapping from '../models/Mapping.js';
// Simple unit test placeholder: ensure mapping model can be created (requires mongo).
// In CI, mock mongoose or use in-memory mongo.
test('mapping model basic', ()=>{
  expect(typeof Mapping).toBe('function');
});
