import React, {useState} from 'react';
import API from '../../utils/api';
export default function ML(){
  const [model, setModel] = useState(null);
  const train = async ()=>{ const r = await API.post('/ml/train', [{example:1}]); setModel(r.data); };
  const predict = async ()=>{ if(!model) return alert('train first'); const r = await API.post('/ml/'+model.modelId+'/predict', { input: {} }); alert(JSON.stringify(r.data)); };
  return (<div><h3>ML Admin</h3><button onClick={train}>Train placeholder model</button><button onClick={predict}>Predict</button>{model && <pre>{JSON.stringify(model,null,2)}</pre>}</div>);
}
