#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Usage:
    crypto.py -e -n <dataset_name> -i <input_path> [-o <output_path>] [-k <key_path>] [--hvac <vault_addr>]
    crypto.py -d -n <dataset_name> -i <input_path> [-k <key_path> | --hvac <vault_addr>] [-o <output_path>]     

Options:
    -e --encrypt           encrypt
    -d --decrypt           decrypt
    -n <dataset_name>, --name <dataset_name>
    -i <input_path>, --input <input_path>
    -o <output_path>, --output <output_path> 
    -k <key_path>, --key <key_path>
    --hvac <vault_addr> using hashicorp vault for key generation and storage
"""
from docopt import docopt
import sys
import nacl.utils
import nacl.secret
import os
from util.helper import make_dir, base64_to_byte
import hvac
from util.VaultClient import VaultClient

version = '0.0.1'
__version__ = version
SECRET_BASE_DIR = "frdr"
EXCLUDED_FILES = [".*", 
                  "Thumbs.db", 
                  ".DS_Store", 
                  "._.DS_Store", 
                  ".localized", 
                  "desktop.ini", 
                  "*.pyc", 
                  "*.swx",
                  "*.swp", 
                  "*~", 
                  "~$*", 
                  "NULLEXT"]

class Cryptor(object):
    def __init__(self, arguments, hvac_client=None):
        self._arguments = arguments
        self._dataset_name = self._arguments["--name"]
        self._input = self._arguments["--input"]
        self._output = self._arguments["--output"]
        self._key_filename = self._arguments["--key"]
        if self._arguments["--hvac"]:
            self.hvac_client = hvac_client
            self.hvac_client.enable_transit_engine()
            self.vault_secret_path = os.path.join(SECRET_BASE_DIR, self._dataset_name)
        self.set_key()
        self.box = nacl.secret.SecretBox(self.key)

    def encrypt(self):
        # encrypt each file in the dirname
        if self._output is None:
            self._output = self._input + '_encrypted'
        if os.path.isdir(self._input):
            all_files, all_subdirs = self._get_files_list(self._input)
            self._create_output_dirs(all_subdirs)
            for each_file in all_files:
                self._encrypt_file(each_file)
        else:
            self._encrypt_file(self._input)

    def decrypt(self):
        if self._output is None:
            self._output = self._input + '_decrypted'
        if os.path.isdir(self._input):
            all_files, all_subdirs = self._get_files_list(self._input)
            self._create_output_dirs(all_subdirs)
            for each_file in all_files:
                self._decrypt_file(each_file)
        else:
            self._decrypt_file(self._input)
        
    def _encrypt_file(self, filename):
        if self._file_excluded(filename, EXCLUDED_FILES):
            return False
        encrypted_filename = os.path.join(os.path.dirname(filename), os.path.basename(filename) + ".encrypted")
        if os.path.isdir(self._input):
            with open(os.path.join(self._input, filename), 'rb') as f:
                message = f.read()
            encrypted = self.box.encrypt(message)
            with open(os.path.join(self._output, encrypted_filename), 'wb') as f:
                f.write(encrypted)
            # TODO: check this
            assert len(encrypted) == len(message) + self.box.NONCE_SIZE + self.box.MACBYTES
            return True
        else:
            with open(filename, 'rb') as f:
                message = f.read()
            encrypted = self.box.encrypt(message)
            with open(encrypted_filename, 'wb') as f:
                f.write(encrypted)

    def _decrypt_file(self, filename):
        decrypted_filename = os.path.join(os.path.dirname(filename), '.'.join(os.path.basename(filename).split('.')[:-1]))
        if os.path.isdir(self._input):
            with open(os.path.join(self._input, filename), 'rb') as f:
                encrypted_message = f.read()
            decrypted = self.box.decrypt(encrypted_message)
            with open(os.path.join(self._output, decrypted_filename), 'wb') as f:
                f.write(decrypted)
        else:
            with open(filename, 'rb') as f:
                encrypted_message = f.read()
            decrypted = self.box.decrypt(encrypted_message)
            with open(decrypted_filename, 'wb') as f:
                f.write(decrypted)
    
    def set_key(self):
        if self._key_filename is None:
            self._key_filename = "{}_key.pem".format(self._input)
            if self._arguments["--encrypt"]:
                self._key = None
            elif self._arguments["--decrypt"]:
                key_ciphertext = self.hvac_client.retrive_key_from_vault(path=self.vault_secret_path)
                key_plaintext = self.hvac_client.decrypt_key(name=self._dataset_name, ciphertext=key_ciphertext)
                self._key = base64_to_byte(key_plaintext)
            else:
                #TODO: raise ERROR
                pass
        else:
            with open(self._key_filename, "rb") as f:
                self._key = f.read()

    @property
    def key(self):
        if self._key is None:
            self.generate_key()
        return self._key
    def generate_key(self):
        if self._arguments["--hvac"]:
            self.hvac_client.create_transit_engine_key(name=self._dataset_name)
            key_plaintext, key_ciphertext = self.hvac_client.generate_data_key(name=self._dataset_name)
            self._key = base64_to_byte(key_plaintext)
            self.hvac_client.save_key_to_vault(path=self.vault_secret_path, key=key_ciphertext)
        else:
            #TODO: put writing to local file in a new class 
            self._key = nacl.utils.random(nacl.secret.SecretBox.KEY_SIZE)
            with open(self._key_filename, 'wb') as f:
                f.write(self._key)

    # get relative path of all files in the input dir
    # return relative paths of all files and subdirs in the dir
    def _get_files_list(self, dirname):  
        files_list = os.listdir(dirname)
        all_files = list()
        all_subdirs = list()
        for entry in files_list:
            full_path = os.path.join(dirname, entry)
            relative_path = os.path.relpath(full_path, self._input)
            if os.path.isdir(full_path):
                all_subdirs.append(relative_path)
                current_files, current_dirs = self._get_files_list(full_path)
                all_subdirs = all_subdirs + current_dirs
                all_files = all_files + current_files
            else:
                all_files.append(relative_path)
        return all_files, all_subdirs
    
    def _create_output_dirs(self, dirs):
        make_dir(self._output)
        for each_dir_rel_path in dirs:
            make_dir(os.path.join(self._output, each_dir_rel_path))

    def _file_excluded(self, filepath, excluded_list):
        """Return True if path or ext in excluded_files list """
        filename = os.path.basename(filepath)
        extension = os.path.splitext(filename)[1][1:].strip().lower()
        # check for filename in excluded_files set
        if filename in excluded_list:
            return True
        # check for extension in and . (dot) files in excluded_files
        if (not extension and 'NULLEXT' in excluded_list) or '*.' + extension in excluded_list or \
                (filename.startswith('.') and u'.*' in excluded_list) or \
                (filename.endswith('~') and u'*~' in excluded_list) or \
                (filename.startswith('~$') and u'~$*' in excluded_list):
            return True
        return False 




if __name__ == "__main__":
    if sys.version_info[0] < 3:
        raise Exception("Python 3 is required to run the local client.")
    arguments = docopt(__doc__, version=__version__)
    if arguments["--hvac"]:
        vault_client = VaultClient(arguments["--hvac"])
    else:
        vault_client = None
    encryptor = Cryptor(arguments, vault_client)
    if arguments["--encrypt"]:
        encryptor.encrypt()
    elif arguments["--decrypt"]:
        encryptor.decrypt()
    else:
        pass