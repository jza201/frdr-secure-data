const notifier = require('node-notifier');
const remote = require('electron').remote;
const {dialog} = require('electron').remote;
const tt = require('electron-tooltip');
let client = remote.getGlobal('client');
tt({position: 'right'})

window.onload = myMain;

function myMain() {
  document.getElementById("menu").onclick = selectMode;
}

function selectMode(e) {
  var encryptExtraBlock = document.getElementById("div-encrypt-extra");
  var decryptExtraBlock = document.getElementById("div-decrypt-extra");
  var grantAccessExtraBlock = document.getElementById("div-grant-access-extra");
  if (e.target.id == "button-encrypt") {
    encryptExtraBlock.style.display = "block";
    decryptExtraBlock.style.display = "none";
    grantAccessExtraBlock.style.display = "none";
  }
  else if (e.target.id == "button-decrypt") {
    decryptExtraBlock.style.display = "block";
    encryptExtraBlock.style.display = "none";
    grantAccessExtraBlock.style.display = "none";
  }
  else if (e.target.id == "button-grant-access") {
    decryptExtraBlock.style.display = "none";
    encryptExtraBlock.style.display = "none";
    grantAccessExtraBlock.style.display = "block";
  }
}

var buttonClicked = document.getElementById("button-encrypt");
function highlightButton(element) {
  if (buttonClicked != null) {
    buttonClicked.classList.remove("active")
  }
  buttonClicked = element;
  buttonClicked.classList.add("active")
}

function encrypt() {
  var hostname = document.getElementById("hostname").value;
  var username = document.getElementById("username").value;
  var password = document.getElementById("password").value;
  client.invoke("encrypt", username, password, hostname, function(error, res, more) {
    if (res === true){
      notifier.notify({"title" : "FRDR-Crypto", "message" : "Dataset has been encrypted and transfer package has been created on Desktop."});
    } else {
      notifier.notify({"title" : "FRDR-Crypto", "message" : "Error encrypting."});
    }
  });
}

function decrypt() {
  var hostname = document.getElementById("hostname").value;
  var username = document.getElementById("username").value;
  var password = document.getElementById("password").value;
  var url = document.getElementById("key_url").value;
  var dataset = url.split("/").pop();
  var options = {
    type: "question",
    buttons: ["Yes", "Cancel"],
    defaultId: 1,
    title: "Confirmation",
    message: `You are trying to decrypt the dataset ${dataset}. \n\nDo you want to continue?`
  }
  const response = dialog.showMessageBox(options);
  if (response == 0) {
    client.invoke("decrypt", username, password, hostname, url, function(error, res, more) {
      if (res === true){
        notifier.notify({"title" : "FRDR-Crypto", "message" : "Dataset has been decrypted and placed on Desktop."});
      } else {
        notifier.notify({"title" : "FRDR-Crypto", "message" : "Error decrypting."});
      }
    });
  }
}


var nodeConsole = require('console');
var myConsole = new nodeConsole.Console(process.stdout, process.stderr);

function grantAccess() {
  // var hostname = document.getElementById("hostname").value;
  // var username = document.getElementById("username").value;
  // var password = document.getElementById("password").value;
  // var dataset = document.getElementById("dataset").value;
  // var requester = document.getElementById("requester").value;

  // Just for testing, no need to type in these vaules
  var hostname = "http://127.0.0.1:8200";
  var username = "bob";
  var password = "training";
  var dataset = "4b3d7807-91e6-47f6-bf09-120998cd340a";
  var requester = "9d32d549-69ac-8685-8abb-bc10b9bc31c4";

  // Try commenting out this line, and clicking the grant access button twice, you will see the confirmation dialog we want
  var requesterName = null;

  client.invoke("get_entity_name", username, password, hostname, requester, function(error, res, more) {
    myConsole.log(res)
    requesterName = res;
  });
  var options = {
    type: "question",
    buttons: ["Yes", "Cancel"],
    defaultId: 1,
    title: "Confirmation",
    message: "Are you sure to grant access to " + requesterName
  }
  const response = dialog.showMessageBox(options);
  if (response == 0){
    client.invoke("grant_access", username, password, hostname, dataset, requester, function(error, res, more) {
      if (res === true){
        notifier.notify({"title" : "FRDR-Crypto", "message" : "Access Granted"});
      } else {
        notifier.notify({"title" : "FRDR-Crypto", "message" : "Error access granting."});
      }
    });
  }
}

document.getElementById("GrantAccess").addEventListener("click", grantAccess);

// Send a open directory selector dialog message from a renderer process to main process 
const ipc = require('electron').ipcRenderer
const selectDirBtn = document.getElementById('input_path_dir')
selectDirBtn.addEventListener('click', function (event) {
     ipc.send('open-dir-dialog')
});
//Getting back the information after selecting the dir
ipc.on('selected-dir', function (event, path) {
//print the path selected
document.getElementById('selected-dir').innerHTML = `You selected: ${path}`
});


document.getElementById("encrypt").addEventListener("click", encrypt);

// Send a open file selector dialog message from a renderer process to main process
const selectFileBtn = document.getElementById('input_path_file')
selectFileBtn.addEventListener('click', function (event) {
     ipc.send('open-file-dialog')
});
//Getting back the information after selecting the file
ipc.on('selected-file', function (event, path) {
//print the path selected
document.getElementById('selected-file').innerHTML = `You selected: ${path}`
});

document.getElementById("decrypt").addEventListener("click", decrypt);

