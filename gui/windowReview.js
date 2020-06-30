"use strict";

const notifier = require('node-notifier');
const remote = require('electron').remote;
const {dialog} = require('electron').remote;
let client = remote.getGlobal('client');

var nodeConsole = require('console');
var myConsole = new nodeConsole.Console(process.stdout, process.stderr);

function revoke() {
  var row = this.parentNode.getElementsByTagName("div")
  var datasetId = row[0].innerHTML;
  var entityName = row[1].innerHTML;
  var entityId = row[2].innerHTML;
  var options = {
    type: "question",
    buttons: ["Yes", "Cancel"],
    defaultId: 1,
    title: "Confirmation",
    message: `You are trying to revoke requester ${entityName} access to dataset ${datasetId}. \n\nDo you want to continue?`
  }
  const response = dialog.showMessageBox(options);
  if (response == 0){
    client.invoke("revoke_access", datasetId, entityId, function(error, res, more) {
      if (res === true){
        notifier.notify({"title" : "FRDR-Crypto", "message" : "Access Revoked"});
        window.location.reload();
      } else {
        notifier.notify({"title" : "FRDR-Crypto", "message" : "Error revoking access."});
      }
    });
  }
}

function load() {
  client.invoke("review_shares", function(error, res, more) {
    var json = JSON.parse(res);
    for (let i in json["data"]) {
      for (let j in json["data"][i]["members"]) {
        var row = document.createElement("DIV");   
        row.className = "row";                   
        document.getElementById("data").appendChild(row);  
        var col1 = document.createElement("DIV");
        col1.className = "col-sm-5 col-md-5 col-lg-5";
        col1.innerHTML = json["data"][i]["dataset_id"];
        var col2 = document.createElement("DIV");
        col2.className = "col-sm-5 col-md-5 col-lg-5";
        col2.innerHTML = json["data"][i]["members"][j]["entity_name"];
        var entityId = document.createElement("DIV");
        entityId.innerHTML = json["data"][i]["members"][j]["entity_id"];
        entityId.style.display = "none";
        var col3 = document.createElement("div");
        col3.className = "btn btn-primary";
        col3.innerHTML = "Revoke";
        col3.addEventListener("click", revoke);
        row.appendChild(col1);
        row.appendChild(col2);
        row.appendChild(entityId);
        row.appendChild(col3);
      }
    }
  });
}

window.addEventListener("load", load);