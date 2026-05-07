

window.masterSheetDataTK3 = [];
window.masterSheetDataTK4 = [];

async function loadGoogleSheetData() {
    try {
        const queryTK3 = API_KEY_TK3 + '?limit=10';
        const queryTK4 = API_KEY_TK4 + '?limit=10';

        console.log("Loading data from googlesheet")

        const [rowsTK3, rowsTK4] = await Promise.all([
            fetchGoogleSheetData(queryTK3),
            fetchGoogleSheetData(queryTK4)
        ])

        if (rowsTK3) {
            window.masterSheetDataTK3 = rowsTK3;
            document.dispatchEvent(new CustomEvent('TK3DataReady'));
        }

        if (rowsTK4) {
            window.masterSheetDataTK4 = rowsTK4;
            document.dispatchEvent(new CustomEvent('TK4DataReady'));
        }
        
        console.log("Loaded all data from googlesheet database!");

    } catch (error) {
        console.log("Lỗi tải dữ liệu hệ thống!", error);
    }
}