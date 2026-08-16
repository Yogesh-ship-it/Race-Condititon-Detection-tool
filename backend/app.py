"""
RaceGuard Flask Web Server
Serves the Race Condition Detection & Visualization Dashboard
"""

import os
from flask import Flask, render_template, jsonify, request
from detector import RaceDetector
from scenarios import SCENARIOS, get_scenario
from code_generator import CodeGenerator

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "frontend"))

app = Flask(
    __name__,
    template_folder=os.path.join(FRONTEND_DIR, "templates"),
    static_folder=os.path.join(FRONTEND_DIR, "static")
)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/scenarios", methods=["GET"])
def list_scenarios():
    summary_list = []
    for sid, sc in SCENARIOS.items():
        summary_list.append({
            "id": sc["id"],
            "title": sc["title"],
            "subtitle": sc["subtitle"],
            "description": sc["description"],
            "variables": sc["variables"]
        })
    return jsonify({"scenarios": summary_list})

@app.route("/api/scenarios/<scenario_id>", methods=["GET"])
def fetch_scenario(scenario_id):
    is_fixed = request.args.get("fixed", "false").lower() in ("true", "1", "yes")
    data = get_scenario(scenario_id, is_fixed)
    return jsonify(data)

@app.route("/api/detect", methods=["POST"])
def detect_races():
    req_data = request.get_json(silent=True) or {}
    events = req_data.get("events", [])
    
    detector = RaceDetector(events)
    result = detector.analyze()
    return jsonify(result)

@app.route("/api/export-code", methods=["POST"])
def export_code():
    req_data = request.get_json(silent=True) or {}
    events = req_data.get("events", [])
    variables = req_data.get("variables", ["counter"])
    is_fixed = req_data.get("is_fixed", False)
    
    code_data = CodeGenerator.generate_all(events, variables, is_fixed)
    return jsonify(code_data)

if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=5000)
