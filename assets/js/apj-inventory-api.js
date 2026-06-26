/* APJ INVENTORY API V23 - kontrak action APJ_INVENTORY_V3 */
(function () {
  'use strict';
  function action(key, fallback) {
    var c = window.APJ_CONFIG || {};
    return (c.actions && c.actions.inventory && c.actions.inventory[key]) || fallback || key;
  }
  function call(key, payload, fallback) {
    if (!window.APJApi) throw new Error('APJApi belum dimuat.');
    return window.APJApi.inventory(action(key, fallback), payload || {});
  }
  window.APJInventoryApi = {
    call: call,
    getDashboardData: function (payload) { return call('dashboard', payload, 'getDashboardData'); },
    getBarang: function (payload) { return call('barang', payload, 'getBarang'); },
    getBarangProduksi: function (payload) { return call('barangProduksi', payload, 'getBarangProduksi'); },
    getOutputInit: function (payload) { return call('outputInit', payload, 'getOutputInit'); },
    getTransferProduksiInit: function (payload) { return call('transferInit', payload, 'getTransferProduksiInit'); },
    getProdukOutletData: function (payload) { return call('produkOutletData', payload, 'getProdukOutletData'); },
    getRiwayatTransaksi: function (payload) { return call('riwayat', payload, 'getRiwayatTransaksi'); },
    getStokAkhirReport: function (payload) { return call('stokAkhir', payload, 'getStokAkhirReport'); },
    getStokProduksiReport: function (payload) { return call('stokProduksi', payload, 'getStokProduksiReport'); },
    getInputPrintOptions: function (payload) { return call('inputPrintOptions', payload, 'getInputPrintOptions'); },
    getInputPrintData: function (payload) { return call('inputPrintData', payload, 'getInputPrintData'); },
    getTransferPrintData: function (payload) { return call('transferPrintData', payload, 'getTransferPrintData'); },
    simpanInputStok: function (payload) { return call('simpanInput', payload, 'simpanInputStok'); },
    simpanInputStokPreparasi: function (payload) { return call('simpanInput', payload, 'simpanInputStok'); },
    simpanTransaksi: function (payload) { return call('simpanOutput', payload, 'simpanTransaksi'); },
    simpanOutputProduksi: function (payload) { return call('simpanProduksi', payload, 'simpanOutputProduksi'); },
    simpanTransferProduksi: function (payload) { return call('simpanTransfer', payload, 'simpanTransferProduksi'); },
    simpanProdukOutletKeluar: function (payload) { return call('simpanProdukKeluar', payload, 'simpanProdukOutletKeluar'); },
    simpanProdukOutletOpname: function (payload) { return call('simpanProdukOpname', payload, 'simpanProdukOutletOpname'); },
    getAdminData: function (payload) { return call('adminData', payload, 'getAdminData'); }
  };
})();
