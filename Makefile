VERSION=`node -pe "require('./package.json').version"`

regtest:
	docker pull rllola/dogecoind:v1.14.6
	mkdir -p /tmp/dogecoin
	docker run --network=host -u $(id -u):$(id -g) --mount "type=bind,src=/tmp/dogecoin,dst=/mnt/data" -v ${PWD}/dogecoin.conf:/mnt/dogecoin.conf:ro --name dogecoind_regtest rllola/dogecoind:v1.14.6
	
restart:
	docker start dogecoind_regtest
	
generate:
	docker exec dogecoind_regtest dogecoin-cli -conf=/mnt/dogecoin.conf generate $(count)
	
clean-regtest:
	rm -rf data/regtest

clean-regtest-data:
	rm -rf data/regtest/spvnode data/regtest/wallet

package: clean-package package-linux package-debian package-win package-macos

package-linux:
	pkg . --targets node16-linux-x64 --out-path dist/linux
	mkdir -p dist/linux/prebuilds
	cp -r node_modules/leveldown/prebuilds/linux-x64 dist/linux/prebuilds
	tar -czvf dogecoin-spv-$(VERSION)-linux-x64.tar.gz dist/linux

CONTROL_FILE = dist/debian/dogecoin-spv/DEBIAN/control
package-debian: package-linux
	rm -rf dist/debian/
	mkdir -p dist/debian/dogecoin-spv/DEBIAN/;mkdir -p dist/debian/dogecoin-spv/usr/bin/
	cp -r dist/linux/* dist/debian/dogecoin-spv/usr/bin/
	# create control file
	touch $(CONTROL_FILE)
	echo "Package: dogecoin-spv" >> $(CONTROL_FILE)
	echo "Architecture: amd64" >> $(CONTROL_FILE)
	echo "Version: $(VERSION)-1" >> $(CONTROL_FILE)
	echo "Maintainer: Malik <malik.mlitat@gmail.com>" >> $(CONTROL_FILE)
	echo "Description: A simple spv wallet for Dogecoin." >> $(CONTROL_FILE)
	dpkg-deb --build dist/debian/dogecoin-spv dist/debian/dogecoin-spv_$(VERSION).deb
	cp dist/debian/dogecoin-spv_$(VERSION).deb .
	rm -rf dist/debian/dogecoin-spv/

package-win:
	pkg . --targets node16-win-x64 --out-path dist/win
	mkdir -p dist/win/prebuilds/win32-x64
	cp -r node_modules/leveldown/prebuilds/win32-x64 dist/win/prebuilds
	zip -r dogecoin-spv-$(VERSION)-win-x64.zip dist/win

package-macos:
	pkg . --targets node16-macos-x64 --out-path dist/darwin
	mkdir -p dist/darwin/prebuilds/darwin-x64
	cp -r node_modules/leveldown/prebuilds/darwin-x64+arm64 dist/darwin/prebuilds
	zip -r dogecoin-spv-$(VERSION)-darwin-x64.zip dist/darwin

clean-package:
	rm -rf dist

install-deps:
	npm install -g pkg

.PHONY: build-regtest regtest restart generate clean-regtest clean-regtest-data clean-package install-deps