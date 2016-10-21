# -*- mode: ruby -*-
# vi: set ft=ruby :

# Vagrantfile API/syntax version. Don't touch unless you know what you're doing!
VAGRANTFILE_API_VERSION = "2"

Vagrant.configure(VAGRANTFILE_API_VERSION) do |config|
    config.vm.provider "virtualbox"
    config.vm.provider "linode"

    config.vm.define "courierchat" do |courierchat|
        # All Vagrant configuration is done here. The most common configuration
        # options are documented and commented below. For a complete reference,
        # please see the online documentation at vagrantup.com.

        # Every Vagrant virtual environment requires a box to build off of.
        courierchat.vm.box = "ubuntu/trusty64"
        courierchat.vm.box_url = "https://cloud-images.ubuntu.com/vagrant/trusty/current/trusty-server-cloudimg-amd64-vagrant-disk1.box"

        # Create a forwarded port mapping which allows access to a specific port
        # within the machine from a port on the host machine. In the example below,
        # accessing "localhost:8080" will access port 80 on the guest machine.
        courierchat.vm.network "forwarded_port", guest: 3000, host: 3000

        # Share an additional folder to the guest VM. The first argument is
        # the path on the host to the actual folder. The second argument is
        # the path on the guest to mount the folder. And the optional third
        # argument is a set of non-required options.
        # config.vm.synced_folder "../data", "/vagrant_data", owner: "vagrant", group: "vagrant"

        config.vm.provider "virtualbox" do |vb|
           vb.gui = false
        end

        courierchat.vm.provision "shell", path: "./vagrant-provision.sh", privileged: false
    end
end
