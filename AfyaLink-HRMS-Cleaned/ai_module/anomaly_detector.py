# Simple Flask microservice to check vitals for anomalies.
from flask import Flask, request, jsonify
import os
app = Flask(__name__)

@app.route('/check', methods=['POST'])
def check():
    data = request.get_json() or {}
    # expected: temperature, pulse, bp (string like '120/80')
    t = data.get('temperature')
    pulse = data.get('pulse')
    bp = data.get('bp','')
    alert = False
    reasons = []
    if t is not None and (t>38 or t<35):
        alert = True
        reasons.append('Abnormal temperature')
    if pulse is not None and (pulse>120 or pulse<40):
        alert = True
        reasons.append('Abnormal pulse')
    if bp:
        try:
            syst = int(bp.split('/')[0])
            if syst>180 or syst<80:
                alert = True
                reasons.append('Abnormal blood pressure')
        except:
            pass
    return jsonify({"alert": alert, "reason": ", ".join(reasons) if reasons else "", "input": data})

if __name__=='__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT',6000)))
