from flask import Flask
from flask import render_template
import json
import pandas as pd
from bson import json_util
from bson.json_util import dumps

app = Flask(__name__)

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/donorschoose/projects")
def donorschoose_projects():
    df = pd.read_csv('output.csv')
    json_projects = df.to_json(orient='records')
    return json_projects

if __name__ == "__main__":
    app.run(host='0.0.0.0',port=5000,debug=True)