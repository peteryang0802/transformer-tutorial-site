// 进度系统：免登录，全部存在浏览器 localStorage。
// 数据结构：
// {
//   lastRead: { chapterId, station },
//   chapters: {
//     "17": { stations: { "0": true, "2": true }, lastStation: 2 }
//   }
// }
const STORAGE_KEY = 'llm-lab-progress-v1';

function loadProgress() {
    try {
        const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (data && typeof data === 'object' && data.chapters) {
            return data;
        }
    } catch (e) { /* 损坏的存档直接重置 */ }
    return { lastRead: null, chapters: {} };
}

function saveProgress(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function ensureChapter(data, chapterId) {
    if (!data.chapters[chapterId]) {
        data.chapters[chapterId] = { stations: {}, lastStation: 0 };
    }
    return data.chapters[chapterId];
}

// 某站是否已点亮
function isLit(chapterId, stationIndex) {
    const data = loadProgress();
    const ch = data.chapters[chapterId];
    return !!(ch && ch.stations[String(stationIndex)]);
}

// 点亮某站，返回是否原本就已点亮
function lightUp(chapterId, stationIndex) {
    const data = loadProgress();
    const ch = ensureChapter(data, chapterId);
    const already = !!ch.stations[String(stationIndex)];
    ch.stations[String(stationIndex)] = true;
    saveProgress(data);
    return already;
}

// 记录当前读到哪一站（同时更新全局续读指针）
function setLastStation(chapterId, stationIndex) {
    const data = loadProgress();
    const ch = ensureChapter(data, chapterId);
    ch.lastStation = stationIndex;
    data.lastRead = { chapterId: String(chapterId), station: stationIndex };
    saveProgress(data);
}

function getLastStation(chapterId) {
    const data = loadProgress();
    const ch = data.chapters[chapterId];
    return ch ? ch.lastStation : 0;
}

// 章节状态：not-started / in-progress / done
function chapterStatus(chapterId, totalStations) {
    const data = loadProgress();
    const ch = data.chapters[chapterId];
    if (!ch) return 'not-started';
    const litCount = Object.keys(ch.stations).filter(k => ch.stations[k]).length;
    if (litCount === 0) return 'not-started';
    if (totalStations && litCount >= totalStations) return 'done';
    return 'in-progress';
}

// 某章点亮了几站
function litCount(chapterId) {
    const data = loadProgress();
    const ch = data.chapters[chapterId];
    if (!ch) return 0;
    return Object.keys(ch.stations).filter(k => ch.stations[k]).length;
}

// 续读目标：返回 { chapterId, station }，没有进度则 null
function getContinueTarget() {
    const data = loadProgress();
    if (data.lastRead && data.chapters[data.lastRead.chapterId]) {
        return data.lastRead;
    }
    return null;
}

// 导出进度为 JSON 字符串，换设备时可手动保存
function exportProgress() {
    return JSON.stringify(loadProgress(), null, 2);
}

// 从 JSON 字符串导入进度，校验通过才写入；返回是否成功
function importProgress(jsonString) {
    try {
        const obj = JSON.parse(jsonString);
        if (obj && typeof obj === 'object' && obj.chapters && typeof obj.chapters === 'object') {
            saveProgress(obj);
            return true;
        }
    } catch (e) { /* 格式不对，返回 false */ }
    return false;
}
