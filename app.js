// Supabase 설정
const SUPABASE_URL = 'https://lqpgfisrsrwdoqnrvzlx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxcGdmaXNyc3J3ZG9xbnJ2emx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxODcwNTgsImV4cCI6MjA3NDc2MzA1OH0.wpN6Uhzd8R1DHAnDNLPGd7TjlFAuwAt2YTW5JeNwKWo';

// 전역 변수
let currentWeeklyDiary = null;
let isAdminAuthenticated = false;
let isAnalysisAuthenticated = false;
let currentWeekInfo = null;
let currentUser = null;

// 관리자 비밀번호
const ADMIN_PASSWORD = 'admin123';

// 페이지 로드 시 초기화
window.onload = function() {
    // 로그인 상태 확인
    checkUserLogin();
};

// 사용자 로그인 상태 확인
function checkUserLogin() {
    const savedUser = sessionStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showMainApp();
        setUserInfo();
    } else {
        showMainApp(); // 바로 메인 화면 표시
    }
}

// 로그인 화면 표시
function showLoginScreen() {
    document.getElementById('loginSection').classList.remove('hidden');
    document.getElementById('mainApp').classList.add('hidden');
}

// 메인 앱 표시
function showMainApp() {
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    
    // 메인 앱 초기화
    initializeMainApp();
}

// 사용자 정보 설정
function setUserInfo() {
    if (currentUser) {
        document.getElementById('currentUser').textContent = `${currentUser.manager_name} (${currentUser.department})`;
        document.getElementById('managerName').value = currentUser.manager_name;
        document.getElementById('managerName').readOnly = true;
        document.getElementById('department').value = currentUser.department;
        document.getElementById('department').readOnly = true;
    } else {
        document.getElementById('currentUser').textContent = '로그인이 필요합니다';
        document.getElementById('managerName').readOnly = false;
        document.getElementById('department').readOnly = false;
    }
}

// 메인 앱 초기화
function initializeMainApp() {
    // 현재 주차를 기본값으로 설정
    const today = new Date();
    const currentWeek = getWeekString(today);
    document.getElementById('weekSelector').value = currentWeek;
    
    // 사용자 정보 설정
    setUserInfo();
    
    // 주간 업무일지 폼 제출 이벤트 리스너 (중복 방지)
    const form = document.getElementById('weeklyWorkForm');
    if (form && !form.hasAttribute('data-listener-added')) {
        form.addEventListener('submit', saveWeeklyDiary);
        form.setAttribute('data-listener-added', 'true');
    }
    
    // 담당자명 입력 시 인증 체크 이벤트 추가
    const managerNameInput = document.getElementById('managerName');
    if (managerNameInput && !managerNameInput.hasAttribute('data-auth-listener')) {
        managerNameInput.addEventListener('blur', checkUserAuth);
        managerNameInput.setAttribute('data-auth-listener', 'true');
    }
    
    // 세션에서 관리자 인증 상태 복원
    if (sessionStorage.getItem('adminAuth') === 'true') {
        isAdminAuthenticated = true;
    }
    
    if (sessionStorage.getItem('analysisAuth') === 'true') {
        isAnalysisAuthenticated = true;
    }
    
    // 연도 선택 옵션 생성
    initializeAnalysisYears();
}

// 사용자 로그인
async function userLogin() {
    const loginName = document.getElementById('loginName').value.trim();
    const loginPassword = document.getElementById('loginPassword').value.trim();
    
    if (!loginName || !loginPassword) {
        showMessage('loginError', '담당자명과 비밀번호를 모두 입력해주세요.');
        return;
    }
    
    try {
        // 사용자 인증
        const query = `${SUPABASE_URL}/rest/v1/user_accounts?manager_name=eq.${encodeURIComponent(loginName)}&password=eq.${encodeURIComponent(loginPassword)}&is_active=eq.true`;
        
        const response = await fetch(query, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });
        
        if (!response.ok) {
            throw new Error('로그인 중 오류가 발생했습니다.');
        }
        
        const users = await response.json();
        
        if (users && users.length > 0) {
            // 로그인 성공
            currentUser = users[0];
            sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
            showMainApp();
        } else {
            // 로그인 실패
            showMessage('loginError', '담당자명 또는 비밀번호가 올바르지 않습니다.');
        }
        
    } catch (err) {
        showMessage('loginError', `로그인 오류: ${err.message}`);
    }
}

// 사용자 인증 체크 (담당자명 입력 시)
async function checkUserAuth() {
    const managerName = document.getElementById('managerName').value.trim();
    
    if (!managerName) {
        return;
    }
    
    // 이미 로그인된 사용자와 같으면 스킵
    if (currentUser && currentUser.manager_name === managerName) {
        return;
    }
    
    try {
        // 해당 사용자가 존재하는지 확인
        const query = `${SUPABASE_URL}/rest/v1/user_accounts?manager_name=eq.${encodeURIComponent(managerName)}&is_active=eq.true`;
        
        const response = await fetch(query, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });
        
        if (response.ok) {
            const users = await response.json();
            
            if (users && users.length > 0) {
                // 사용자가 존재하면 비밀번호 요청
                const password = prompt(`${managerName}님의 비밀번호를 입력하세요:`);
                
                if (password) {
                    await authenticateUser(managerName, password);
                } else {
                    // 비밀번호 입력 취소 시 필드 초기화
                    document.getElementById('managerName').value = '';
                }
            } else {
                // 사용자가 없으면 경고
                alert(`"${managerName}" 사용자를 찾을 수 없습니다.\n관리자에게 계정 생성을 요청하세요.`);
                document.getElementById('managerName').value = '';
            }
        }
    } catch (err) {
        console.error('사용자 확인 오류:', err);
    }
}

// 사용자 인증 처리
async function authenticateUser(managerName, password) {
    try {
        const query = `${SUPABASE_URL}/rest/v1/user_accounts?manager_name=eq.${encodeURIComponent(managerName)}&password=eq.${encodeURIComponent(password)}&is_active=eq.true`;
        
        const response = await fetch(query, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });
        
        if (response.ok) {
            const users = await response.json();
            
            if (users && users.length > 0) {
                // 인증 성공
                currentUser = users[0];
                sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
                setUserInfo();
                
                // 기존 데이터 자동 불러오기
                setTimeout(() => {
                    autoLoadExistingData();
                }, 300);
                
                showMessage('weeklySuccess', `✓ ${managerName}님 로그인 성공!`);
            } else {
                // 비밀번호 틀림
                alert('비밀번호가 올바르지 않습니다.');
                document.getElementById('managerName').value = '';
            }
        }
    } catch (err) {
        alert(`인증 오류: ${err.message}`);
        document.getElementById('managerName').value = '';
    }
}

// 사용자 로그아웃
function userLogout() {
    if (confirm('로그아웃 하시겠습니까?')) {
        currentUser = null;
        sessionStorage.removeItem('currentUser');
        sessionStorage.removeItem('adminAuth');
        sessionStorage.removeItem('analysisAuth');
        isAdminAuthenticated = false;
        isAnalysisAuthenticated = false;
        
        // 폼 초기화
        document.getElementById('weeklyWorkForm').reset();
        setUserInfo();
        
        showMessage('weeklySuccess', '✓ 로그아웃되었습니다.');
    }
}

// 탭 전환 함수
function showTab(tabName) {
    // 모든 탭 버튼과 콘텐츠 비활성화
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // 선택된 탭 활성화
    event.target.classList.add('active');
    document.getElementById(tabName + 'Tab').classList.add('active');
    
    // 관리자 탭이 선택되면 인증 확인
    if (tabName === 'manage') {
        checkAdminAuth();
    }
    
    // 월간 분석 탭이 선택되면 인증 확인
    if (tabName === 'analysis') {
        checkAnalysisAuth();
    }
    
    // 사용자 관리 탭이 선택되면 인증 확인
    if (tabName === 'users') {
        checkUserAdminAuth();
    }
}

// 주차 문자열 생성 (YYYY-WXX 형식)
function getWeekString(date) {
    const year = date.getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const days = Math.floor((date - startOfYear) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
    return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
}

// 주차 정보 업데이트
function updateWeekInfo() {
    const weekSelector = document.getElementById('weekSelector');
    const weekValue = weekSelector.value;
    
    if (!weekValue) {
        return;
    }
    
    // YYYY-WXX 형식 파싱
    const [year, weekStr] = weekValue.split('-W');
    const weekNumber = parseInt(weekStr);
    
    // ISO 주차 계산 (더 정확한 방법)
    const jan4 = new Date(year, 0, 4);
    const startOfWeek = new Date(jan4);
    startOfWeek.setDate(jan4.getDate() - jan4.getDay() + 1 + (weekNumber - 1) * 7);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    // 주간 정보 저장
    currentWeekInfo = {
        year: parseInt(year),
        weekNumber: weekNumber,
        startDate: startOfWeek,
        endDate: endOfWeek
    };
    
    // 주간 정보 표시
    displayWeekInfo();
    
    // 주간 폼 표시
    document.getElementById('weekInfoDisplay').classList.remove('hidden');
    document.getElementById('weeklyWorkForm').classList.remove('hidden');
    
    // 각 요일 날짜 표시
    updateDayDates();
    
    // 담당자명이 입력되어 있으면 자동으로 기존 데이터 불러오기
    const managerName = document.getElementById('managerName').value.trim();
    if (managerName) {
        setTimeout(() => {
            autoLoadExistingData();
        }, 500);
    }
}

// 주간 정보 표시
function displayWeekInfo() {
    if (!currentWeekInfo) return;
    
    const weekTitle = document.getElementById('weekTitle');
    const startStr = currentWeekInfo.startDate.toLocaleDateString('ko-KR');
    const endStr = currentWeekInfo.endDate.toLocaleDateString('ko-KR');
    
    weekTitle.textContent = `${currentWeekInfo.year}년 ${currentWeekInfo.weekNumber}주차 (${startStr} ~ ${endStr})`;
}

// 각 요일 날짜 표시
function updateDayDates() {
    if (!currentWeekInfo) return;
    
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    const startDate = new Date(currentWeekInfo.startDate);
    
    days.forEach((day, index) => {
        const dayDate = new Date(startDate);
        dayDate.setDate(startDate.getDate() + index);
        document.getElementById(day + 'Date').textContent = dayDate.toLocaleDateString('ko-KR');
    });
}

// 진행률 업데이트
function updateProgress() {
    const textareas = [
        'mondayWork', 'tuesdayWork', 'wednesdayWork', 
        'thursdayWork', 'fridayWork', 'overtimeWork'
    ];
    
    let completedCount = 0;
    const totalCount = textareas.length;
    
    textareas.forEach(id => {
        const textarea = document.getElementById(id);
        const statusElement = document.getElementById(id.replace('Work', 'Status'));
        const daySection = textarea.closest('.day-section');
        
        if (textarea.value.trim()) {
            completedCount++;
            statusElement.textContent = '작성완료';
            statusElement.className = 'day-status completed';
            daySection.classList.add('completed');
        } else {
            statusElement.textContent = '미작성';
            statusElement.className = 'day-status incomplete';
            daySection.classList.remove('completed');
        }
    });
    
    const progressPercent = Math.round((completedCount / totalCount) * 100);
    document.getElementById('progressFill').style.width = progressPercent + '%';
    document.getElementById('progressText').textContent = progressPercent + '%';
}

// 자동으로 기존 데이터 불러오기 (조용히)
async function autoLoadExistingData() {
    const managerName = document.getElementById('managerName').value.trim();
    const weekSelector = document.getElementById('weekSelector').value;
    
    if (!managerName || !weekSelector) {
        return;
    }
    
    // 주차 정보 업데이트
    if (!currentWeekInfo) {
        updateWeekInfo();
    }
    
    if (!currentWeekInfo) {
        const [year, weekStr] = weekSelector.split('-W');
        const weekNumber = parseInt(weekStr);
        currentWeekInfo = {
            year: parseInt(year),
            weekNumber: weekNumber,
            startDate: new Date(),
            endDate: new Date()
        };
    }
    
    try {
        const query = `${SUPABASE_URL}/rest/v1/weekly_work_diary?manager_name=eq.${encodeURIComponent(managerName)}&year=eq.${currentWeekInfo.year}&week_number=eq.${currentWeekInfo.weekNumber}`;
        
        const response = await fetch(query, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            
            if (data && data.length > 0) {
                const diary = data[0];
                currentWeeklyDiary = diary;
                
                // 폼에 데이터 채우기 (조용히)
                document.getElementById('department').value = diary.department || '';
                document.getElementById('mondayWork').value = diary.monday_work || '';
                document.getElementById('tuesdayWork').value = diary.tuesday_work || '';
                document.getElementById('wednesdayWork').value = diary.wednesday_work || '';
                document.getElementById('thursdayWork').value = diary.thursday_work || '';
                document.getElementById('fridayWork').value = diary.friday_work || '';
                document.getElementById('overtimeWork').value = diary.overtime_work || '';
                document.getElementById('weeklySummary').value = diary.weekly_summary || '';
                
                // 진행률 업데이트
                updateProgress();
                
                // 수정 모드로 변경
                document.getElementById('formTitle').textContent = '📝 주간 업무일지 수정';
                document.querySelector('.btn-primary').textContent = '주간일지 업데이트';
                
                // 조용한 성공 메시지
                showMessage('weeklySuccess', `✓ 기존 데이터를 불러왔습니다. (완성도: ${diary.completion_rate || 0}%)`);
            }
        }
    } catch (err) {
        console.log('자동 불러오기 실패 (정상):', err.message);
    }
}

// 기존 주간일지 불러오기
async function loadExistingWeekly() {
    const managerName = document.getElementById('managerName').value.trim();
    const weekSelector = document.getElementById('weekSelector').value;
    
    console.log('불러오기 시작 - 담당자:', managerName, '주차:', weekSelector);
    
    if (!managerName) {
        alert('담당자명을 먼저 입력해주세요.');
        return;
    }
    
    if (!weekSelector) {
        alert('주차를 선택해주세요.');
        return;
    }
    
    // 주차 정보 업데이트
    if (!currentWeekInfo) {
        updateWeekInfo();
    }
    
    // currentWeekInfo가 여전히 null인 경우 수동으로 파싱
    if (!currentWeekInfo) {
        const [year, weekStr] = weekSelector.split('-W');
        const weekNumber = parseInt(weekStr);
        currentWeekInfo = {
            year: parseInt(year),
            weekNumber: weekNumber
        };
    }
    
    console.log('주차 정보:', currentWeekInfo);
    
    try {
        // 기존 주간일지 조회
        const query = `${SUPABASE_URL}/rest/v1/weekly_work_diary?manager_name=eq.${encodeURIComponent(managerName)}&year=eq.${currentWeekInfo.year}&week_number=eq.${currentWeekInfo.weekNumber}`;
        
        console.log('조회 쿼리:', query);
        
        const response = await fetch(query, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });
        
        console.log('응답 상태:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('응답 오류:', errorText);
            throw new Error(`데이터를 불러올 수 없습니다. (${response.status})`);
        }
        
        const diaries = await response.json();
        console.log('조회된 데이터:', diaries);
        
        if (diaries && diaries.length > 0) {
            const diary = diaries[0];
            currentWeeklyDiary = diary;
            
            console.log('불러온 주간일지:', diary);
            
            // 폼에 데이터 채우기
            document.getElementById('department').value = diary.department || '';
            document.getElementById('mondayWork').value = diary.monday_work || '';
            document.getElementById('tuesdayWork').value = diary.tuesday_work || '';
            document.getElementById('wednesdayWork').value = diary.wednesday_work || '';
            document.getElementById('thursdayWork').value = diary.thursday_work || '';
            document.getElementById('fridayWork').value = diary.friday_work || '';
            document.getElementById('overtimeWork').value = diary.overtime_work || '';
            document.getElementById('weeklySummary').value = diary.weekly_summary || '';
            
            // 진행률 업데이트
            updateProgress();
            
            showMessage('weeklySuccess', '✓ 기존 주간일지를 불러왔습니다.');
        } else {
            console.log('해당 주차의 데이터가 없습니다.');
            showMessage('weeklyError', 'ℹ️ 해당 주차의 업무일지가 없습니다. 새로 작성해주세요.');
        }
        
    } catch (err) {
        console.error('주간일지 불러오기 상세 오류:', err);
        showMessage('weeklyError', `✗ 오류: ${err.message}`);
    }
}

// 주간일지 저장
async function saveWeeklyDiary(event) {
    event.preventDefault();
    
    if (!currentWeekInfo) {
        showMessage('weeklyError', '주차 정보가 없습니다. 주차를 선택해주세요.');
        return;
    }
    
    const loading = document.getElementById('weeklyLoading');
    const success = document.getElementById('weeklySuccess');
    const error = document.getElementById('weeklyError');
    
    // 상태 초기화
    loading.classList.remove('hidden');
    success.classList.add('hidden');
    error.classList.add('hidden');
    
    try {
        // 폼 데이터 수집
        const formData = new FormData(event.target);
        const managerName = document.getElementById('managerName').value.trim();
        const department = document.getElementById('department').value.trim();
        
        if (!managerName) {
            throw new Error('담당자명을 입력해주세요.');
        }
        
        // 진행률 계산
        const workContents = [
            formData.get('mondayWork'),
            formData.get('tuesdayWork'),
            formData.get('wednesdayWork'),
            formData.get('thursdayWork'),
            formData.get('fridayWork'),
            formData.get('overtimeWork')
        ];
        
        const completedCount = workContents.filter(content => content && content.trim()).length;
        const completionRate = Math.round((completedCount / 6) * 100);
        
        const weeklyData = {
            manager_name: managerName,
            department: department || null,
            year: currentWeekInfo.year,
            week_number: currentWeekInfo.weekNumber,
            week_start_date: currentWeekInfo.startDate.toISOString().split('T')[0],
            week_end_date: currentWeekInfo.endDate.toISOString().split('T')[0],
            monday_work: formData.get('mondayWork') || null,
            tuesday_work: formData.get('tuesdayWork') || null,
            wednesday_work: formData.get('wednesdayWork') || null,
            thursday_work: formData.get('thursdayWork') || null,
            friday_work: formData.get('fridayWork') || null,
            overtime_work: formData.get('overtimeWork') || null,
            weekly_summary: formData.get('weeklySummary') || null,
            completion_rate: completionRate,
            status: completionRate === 100 ? '완료' : '작성중'
        };
        
        let response;
        
        if (currentWeeklyDiary) {
            // 기존 데이터 업데이트
            response = await fetch(`${SUPABASE_URL}/rest/v1/weekly_work_diary?id=eq.${currentWeeklyDiary.id}`, {
                method: 'PATCH',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify(weeklyData)
            });
        } else {
            // 새 데이터 생성
            response = await fetch(`${SUPABASE_URL}/rest/v1/weekly_work_diary`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify(weeklyData)
            });
        }
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || '저장 중 오류가 발생했습니다.');
        }
        
        const savedData = await response.json();
        currentWeeklyDiary = savedData[0] || savedData;
        
        loading.classList.add('hidden');
        showMessage('weeklySuccess', `✓ 주간일지가 성공적으로 저장되었습니다! (완성도: ${completionRate}%)`);
        
        console.log('저장된 데이터:', currentWeeklyDiary);
        
    } catch (err) {
        loading.classList.add('hidden');
        showMessage('weeklyError', `✗ 오류: ${err.message}`);
        console.error('저장 오류:', err);
    }
}

// 일일 업무 제출 (개별 요일 저장)
async function submitDailyWork() {
    const managerName = document.getElementById('managerName').value.trim();
    const weekSelector = document.getElementById('weekSelector').value;
    
    if (!managerName) {
        alert('담당자명을 먼저 입력해주세요.');
        return;
    }
    
    if (!weekSelector) {
        alert('주차를 선택해주세요.');
        return;
    }
    
    // 주차 정보 업데이트
    if (!currentWeekInfo) {
        updateWeekInfo();
    }
    
    if (!currentWeekInfo) {
        const [year, weekStr] = weekSelector.split('-W');
        const weekNumber = parseInt(weekStr);
        currentWeekInfo = {
            year: parseInt(year),
            weekNumber: weekNumber,
            startDate: new Date(),
            endDate: new Date()
        };
    }
    
    const loading = document.getElementById('weeklyLoading');
    const success = document.getElementById('weeklySuccess');
    const error = document.getElementById('weeklyError');
    
    loading.classList.remove('hidden');
    success.classList.add('hidden');
    error.classList.add('hidden');
    
    try {
        // 현재 입력된 데이터 수집
        const department = document.getElementById('department').value.trim();
        const currentData = {
            manager_name: managerName,
            department: department || null,
            year: currentWeekInfo.year,
            week_number: currentWeekInfo.weekNumber,
            week_start_date: currentWeekInfo.startDate.toISOString().split('T')[0],
            week_end_date: currentWeekInfo.endDate.toISOString().split('T')[0],
            monday_work: document.getElementById('mondayWork').value || null,
            tuesday_work: document.getElementById('tuesdayWork').value || null,
            wednesday_work: document.getElementById('wednesdayWork').value || null,
            thursday_work: document.getElementById('thursdayWork').value || null,
            friday_work: document.getElementById('fridayWork').value || null,
            overtime_work: document.getElementById('overtimeWork').value || null,
            weekly_summary: document.getElementById('weeklySummary').value || null
        };
        
        // 진행률 계산
        const workContents = [
            currentData.monday_work,
            currentData.tuesday_work,
            currentData.wednesday_work,
            currentData.thursday_work,
            currentData.friday_work,
            currentData.overtime_work
        ];
        
        const completedCount = workContents.filter(content => content && content.trim()).length;
        const completionRate = Math.round((completedCount / 6) * 100);
        
        currentData.completion_rate = completionRate;
        currentData.status = '작성중'; // 제출은 항상 작성중 상태
        
        // 기존 데이터가 있는지 확인
        const checkQuery = `${SUPABASE_URL}/rest/v1/weekly_work_diary?manager_name=eq.${encodeURIComponent(managerName)}&year=eq.${currentWeekInfo.year}&week_number=eq.${currentWeekInfo.weekNumber}`;
        
        const checkResponse = await fetch(checkQuery, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });

        let response;
        let isUpdate = false;
        
        if (checkResponse.ok) {
            const existingData = await checkResponse.json();
            
            if (existingData && existingData.length > 0) {
                // 기존 데이터 업데이트
                isUpdate = true;
                const existingDiary = existingData[0];
                currentWeeklyDiary = existingDiary;
                
                // 기존 데이터와 현재 데이터 병합 (빈 값은 기존 값 유지)
                const mergedData = {
                    monday_work: currentData.monday_work || existingDiary.monday_work,
                    tuesday_work: currentData.tuesday_work || existingDiary.tuesday_work,
                    wednesday_work: currentData.wednesday_work || existingDiary.wednesday_work,
                    thursday_work: currentData.thursday_work || existingDiary.thursday_work,
                    friday_work: currentData.friday_work || existingDiary.friday_work,
                    overtime_work: currentData.overtime_work || existingDiary.overtime_work,
                    weekly_summary: currentData.weekly_summary || existingDiary.weekly_summary,
                    department: currentData.department || existingDiary.department
                };
                
                // 병합된 데이터로 진행률 재계산
                const mergedWorkContents = [
                    mergedData.monday_work,
                    mergedData.tuesday_work,
                    mergedData.wednesday_work,
                    mergedData.thursday_work,
                    mergedData.friday_work,
                    mergedData.overtime_work
                ];
                
                const mergedCompletedCount = mergedWorkContents.filter(content => content && content.trim()).length;
                const mergedCompletionRate = Math.round((mergedCompletedCount / 6) * 100);
                
                mergedData.completion_rate = mergedCompletionRate;
                mergedData.status = '작성중';
                
                response = await fetch(`${SUPABASE_URL}/rest/v1/weekly_work_diary?id=eq.${existingDiary.id}`, {
                    method: 'PATCH',
                    headers: {
                        'apikey': SUPABASE_KEY,
                        'Authorization': `Bearer ${SUPABASE_KEY}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify(mergedData)
                });
            } else {
                // 새 데이터 생성
                response = await fetch(`${SUPABASE_URL}/rest/v1/weekly_work_diary`, {
                    method: 'POST',
                    headers: {
                        'apikey': SUPABASE_KEY,
                        'Authorization': `Bearer ${SUPABASE_KEY}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify(currentData)
                });
            }
        } else {
            // 새 데이터 생성
            response = await fetch(`${SUPABASE_URL}/rest/v1/weekly_work_diary`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify(currentData)
            });
        }
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || '제출 중 오류가 발생했습니다.');
        }
        
        const savedData = await response.json();
        currentWeeklyDiary = savedData[0] || savedData;
        
        loading.classList.add('hidden');

        // 제출된 요일 확인
        const submittedDays = [];
        if (document.getElementById('mondayWork').value.trim()) submittedDays.push('월요일');
        if (document.getElementById('tuesdayWork').value.trim()) submittedDays.push('화요일');
        if (document.getElementById('wednesdayWork').value.trim()) submittedDays.push('수요일');
        if (document.getElementById('thursdayWork').value.trim()) submittedDays.push('목요일');
        if (document.getElementById('fridayWork').value.trim()) submittedDays.push('금요일');
        if (document.getElementById('overtimeWork').value.trim()) submittedDays.push('특근');
        
        const submittedText = submittedDays.length > 0 ? submittedDays.join(', ') : '업무 내용';
        
        showMessage('weeklySuccess', `✓ ${submittedText}이(가) 제출되었습니다! (완성도: ${currentData.completion_rate}%)`);
        
        // 진행률 업데이트
        updateProgress();
        
    } catch (err) {
        loading.classList.add('hidden');
        showMessage('weeklyError', `✗ 제출 오류: ${err.message}`);
    }
}

// 주간 폼 초기화
function clearWeeklyForm() {
    if (confirm('작성 중인 내용이 모두 삭제됩니다. 계속하시겠습니까?')) {
        document.getElementById('weeklyWorkForm').reset();
        currentWeeklyDiary = null;
        updateProgress();
        
        // 로컬 데이터 정리
        currentWeeklyDiary = null;
        
        // 신규 작성 모드로 복원
        document.getElementById('formTitle').textContent = '📅 주간 업무일지 작성';
        document.querySelector('.btn-primary').textContent = '주간일지 저장';
        
        showMessage('weeklySuccess', '✓ 폼이 초기화되었습니다.');
    }
}

// 주간업무 수정 (기존 데이터 불러오기) - 수동 버튼용
async function loadExistingWeekly() {
    const managerName = document.getElementById('managerName').value.trim();
    const weekSelector = document.getElementById('weekSelector').value;
    
    if (!managerName) {
        alert('담당자명을 먼저 입력해주세요.');
        return;
    }
    
    if (!weekSelector) {
        alert('주차를 선택해주세요.');
        return;
    }
    
    // 자동 불러오기 함수 재사용
    await autoLoadExistingData();
    
    if (!currentWeeklyDiary) {
        showMessage('weeklyError', 'ℹ️ 해당 주차의 업무일지가 없습니다. 새로 작성해주세요.');
    }
}

// 메시지 표시 함수
function showMessage(elementId, message) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
        element.classList.remove('hidden');
        
        setTimeout(() => {
            element.classList.add('hidden');
        }, 5000); // 5초로 연장
    } else {
        console.error('메시지 요소를 찾을 수 없습니다:', elementId);
        alert(message); // 대체 방법으로 alert 사용
    }
}

// 관리자 인증 확인 함수
function checkAdminAuth() {
    const authSection = document.getElementById('adminAuthSection');
    const mainSection = document.getElementById('adminMainSection');
    
    if (isAdminAuthenticated) {
        authSection.classList.add('hidden');
        mainSection.classList.remove('hidden');
        loadWeeklyDiaries();
    } else {
        authSection.classList.remove('hidden');
        mainSection.classList.add('hidden');
        document.getElementById('adminPassword').value = '';
        document.getElementById('authError').classList.add('hidden');
    }
}

// 관리자 인증 함수
function authenticateAdmin() {
    const password = document.getElementById('adminPassword').value;
    const authError = document.getElementById('authError');
    
    if (password === ADMIN_PASSWORD) {
        isAdminAuthenticated = true;
        authError.classList.add('hidden');
        checkAdminAuth();
        sessionStorage.setItem('adminAuth', 'true');
    } else {
        authError.textContent = '❌ 비밀번호가 올바르지 않습니다.';
        authError.classList.remove('hidden');
        document.getElementById('adminPassword').value = '';
        document.getElementById('adminPassword').focus();
    }
}

// 관리자 로그아웃 함수
function logoutAdmin() {
    if (confirm('로그아웃 하시겠습니까?')) {
        isAdminAuthenticated = false;
        sessionStorage.removeItem('adminAuth');
        checkAdminAuth();
    }
}

// 주간 업무일지 목록 로드
async function loadWeeklyDiaries() {
    const diaryList = document.getElementById('weeklyDiaryList');
    
    try {
        diaryList.innerHTML = '<div class="loading-text">주간 업무일지를 불러오는 중...</div>';
        
        // 필터 값 가져오기
        const filterWeek = document.getElementById('filterWeek')?.value || '';
        const filterManagerName = document.getElementById('filterManagerName')?.value.trim() || '';
        const filterDepartment = document.getElementById('filterDepartment')?.value || '';
        const filterStatus = document.getElementById('filterStatus')?.value || '';
        
        // 쿼리 구성
        let query = `${SUPABASE_URL}/rest/v1/weekly_work_diary?select=*&order=created_at.desc`;
        
        if (filterWeek) {
            const [year, weekStr] = filterWeek.split('-W');
            const weekNumber = parseInt(weekStr);
            query += `&year=eq.${year}&week_number=eq.${weekNumber}`;
        }
        
        if (filterManagerName) {
            query += `&manager_name=ilike.*${filterManagerName}*`;
        }
        
        if (filterDepartment) {
            query += `&department=eq.${filterDepartment}`;
        }
        
        if (filterStatus) {
            query += `&status=eq.${filterStatus}`;
        }
        
        const response = await fetch(query, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });
        
        if (!response.ok) {
            throw new Error('데이터를 불러올 수 없습니다.');
        }
        
        const diaries = await response.json();
        
        if (!diaries || diaries.length === 0) {
            diaryList.innerHTML = '<div class="no-data">등록된 주간 업무일지가 없습니다.</div>';
            return;
        }

        // 주간 업무일지 목록 렌더링
        let html = '';
        diaries.forEach(diary => {
            const startDate = new Date(diary.week_start_date).toLocaleDateString('ko-KR');
            const endDate = new Date(diary.week_end_date).toLocaleDateString('ko-KR');
            const createdAt = new Date(diary.created_at).toLocaleDateString('ko-KR');
            const openedStatus = diary.is_opened ? 
                `<span class="opened-badge">✓ 확인완료 (${new Date(diary.opened_at).toLocaleDateString('ko-KR')})</span>` : 
                '';
            
            // 요일별 완성도 표시
            const dayWorks = [
                { name: '월', content: diary.monday_work },
                { name: '화', content: diary.tuesday_work },
                { name: '수', content: diary.wednesday_work },
                { name: '목', content: diary.thursday_work },
                { name: '금', content: diary.friday_work },
                { name: '특근', content: diary.overtime_work }
            ];
            
            const dayIndicators = dayWorks.map(day => {
                const isCompleted = day.content && day.content.trim();
                return `<div class="day-indicator ${day.name} ${isCompleted ? 'completed' : 'incomplete'}">${day.name}</div>`;
            }).join('');
            
            const summaryPreview = diary.weekly_summary ? 
                (diary.weekly_summary.length > 100 ? 
                    diary.weekly_summary.substring(0, 100) + '...' : 
                    diary.weekly_summary) : 
                '주간 요약이 없습니다.';
            
            html += `
                <div class="weekly-diary-item" onclick="showWeeklyDetail('${diary.id}')">
                    <div class="weekly-header">
                        <div class="weekly-title">${diary.manager_name} - ${diary.department || '부서미지정'}</div>
                        <div style="display: flex; gap: 10px; align-items: center;">
                            <span class="status-badge status-${diary.status}">${diary.status}</span>
                            ${openedStatus}
                        </div>
                    </div>
                    <div class="weekly-meta">
                        <span>📅 ${diary.year}년 ${diary.week_number}주차 (${startDate} ~ ${endDate})</span>
                        <span>📝 작성일: ${createdAt}</span>
                        <div class="weekly-progress-display">
                            <span>진행률: ${diary.completion_rate}%</span>
                            <div class="mini-progress-bar">
                                <div class="mini-progress-fill" style="width: ${diary.completion_rate}%"></div>
                            </div>
                        </div>
                    </div>
                    <div class="day-completion-indicators">
                        ${dayIndicators}
                    </div>
                    <div class="weekly-summary-preview">
                        ${summaryPreview}
                    </div>
                </div>
            `;
        });
        
        diaryList.innerHTML = html;
        
    } catch (err) {
        diaryList.innerHTML = `<div class="no-data">오류: ${err.message}</div>`;
        console.error('주간 업무일지 로드 오류:', err);
    }
}

// 주간 업무일지 상세보기
async function showWeeklyDetail(diaryId) {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/weekly_work_diary?id=eq.${diaryId}&select=*`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });
        
        if (!response.ok) {
            throw new Error('상세 정보를 불러올 수 없습니다.');
        }
        
        const diaries = await response.json();
        if (!diaries || diaries.length === 0) {
            throw new Error('해당 주간일지를 찾을 수 없습니다.');
        }
        
        const diary = diaries[0];
        currentDiary = diary;
        
        // 모달 내용 구성
        const modalBody = document.getElementById('modalBody');
        const startDate = new Date(diary.week_start_date).toLocaleDateString('ko-KR');
        const endDate = new Date(diary.week_end_date).toLocaleDateString('ko-KR');
        const createdAt = new Date(diary.created_at).toLocaleString('ko-KR');
        const updatedAt = new Date(diary.updated_at).toLocaleString('ko-KR');
        
        let openedInfo = '';
        if (diary.is_opened) {
            const openedAt = new Date(diary.opened_at).toLocaleString('ko-KR');
            openedInfo = `
                <div class="detail-item">
                    <div class="detail-label">확인 상태</div>
                    <div class="detail-value">✓ 확인완료 - ${diary.opened_by || '관리자'} (${openedAt})</div>
                </div>
            `;
        }
        
        // 요일별 업무 내용
        const dayWorks = [
            { name: '월요일', content: diary.monday_work },
            { name: '화요일', content: diary.tuesday_work },
            { name: '수요일', content: diary.wednesday_work },
            { name: '목요일', content: diary.thursday_work },
            { name: '금요일', content: diary.friday_work },
            { name: '특근', content: diary.overtime_work }
        ];
        
        let dayWorksHtml = '';
        dayWorks.forEach(day => {
            if (day.content && day.content.trim()) {
                dayWorksHtml += `
                    <div class="detail-item">
                        <div class="detail-label">${day.name}</div>
                        <div class="detail-value">${day.content.replace(/\n/g, '<br>')}</div>
                    </div>
                `;
            }
        });
        
        modalBody.innerHTML = `
            <div class="detail-item">
                <div class="detail-label">담당자명</div>
                <div class="detail-value">${diary.manager_name}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">부서명</div>
                <div class="detail-value">${diary.department || '부서미지정'}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">주차</div>
                <div class="detail-value">${diary.year}년 ${diary.week_number}주차 (${startDate} ~ ${endDate})</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">완성도</div>
                <div class="detail-value">${diary.completion_rate}% (${diary.status})</div>
            </div>
            ${dayWorksHtml}
            ${diary.weekly_summary ? `
                <div class="detail-item">
                    <div class="detail-label">주간 요약</div>
                    <div class="detail-value">${diary.weekly_summary.replace(/\n/g, '<br>')}</div>
                </div>
            ` : ''}
            ${openedInfo}
            <div class="detail-item">
                <div class="detail-label">작성 시간</div>
                <div class="detail-value">${createdAt}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">수정 시간</div>
                <div class="detail-value">${updatedAt}</div>
            </div>
        `;
        
        // 모달 표시
        document.getElementById('detailModal').classList.remove('hidden');
        
    } catch (err) {
        alert(`오류: ${err.message}`);
        console.error('상세보기 오류:', err);
    }
}

// 확인 완료 처리 함수
async function markAsOpened() {
    if (!currentDiary) return;
    
    try {
        const adminName = prompt('관리자 이름을 입력해주세요:', '관리자') || '관리자';
        
        const response = await fetch(`${SUPABASE_URL}/rest/v1/weekly_work_diary?id=eq.${currentDiary.id}`, {
            method: 'PATCH',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                is_opened: true,
                opened_at: new Date().toISOString(),
                opened_by: adminName,
                status: '완료'
            })
        });
        
        if (!response.ok) {
            throw new Error('확인 완료 처리 중 오류가 발생했습니다.');
        }
        
        alert('✓ 확인 완료 처리되었습니다!');
        closeModal();
        loadWeeklyDiaries();

    } catch (err) {
        alert(`오류: ${err.message}`);
        console.error('확인 완료 처리 오류:', err);
    }
}

// 모달 닫기 함수
function closeModal() {
    document.getElementById('detailModal').classList.add('hidden');
    currentDiary = null;
}

// 모달 외부 클릭 시 닫기
document.addEventListener('click', function(event) {
    const modal = document.getElementById('detailModal');
    if (event.target === modal) {
        closeModal();
    }
});

// ESC 키로 모달 닫기
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeModal();
    }
});

// 월간 분석 관련 함수들 (기존 코드 유지)
function checkAnalysisAuth() {
    const authSection = document.getElementById('analysisAuthSection');
    const mainSection = document.getElementById('analysisMainSection');
    
    if (isAnalysisAuthenticated) {
        authSection.classList.add('hidden');
        mainSection.classList.remove('hidden');
        initializeAnalysisYears();
    } else {
        authSection.classList.remove('hidden');
        mainSection.classList.add('hidden');
        document.getElementById('analysisPassword').value = '';
        document.getElementById('analysisAuthError').classList.add('hidden');
    }
}

function authenticateAnalysis() {
    const password = document.getElementById('analysisPassword').value;
    const authError = document.getElementById('analysisAuthError');
    
    if (password === ADMIN_PASSWORD) {
        isAnalysisAuthenticated = true;
        authError.classList.add('hidden');
        checkAnalysisAuth();
        sessionStorage.setItem('analysisAuth', 'true');
    } else {
        authError.textContent = '❌ 비밀번호가 올바르지 않습니다.';
        authError.classList.remove('hidden');
        document.getElementById('analysisPassword').value = '';
        document.getElementById('analysisPassword').focus();
    }
}

function logoutAnalysis() {
    if (confirm('로그아웃 하시겠습니까?')) {
        isAnalysisAuthenticated = false;
        sessionStorage.removeItem('analysisAuth');
        checkAnalysisAuth();
    }
}

function initializeAnalysisYears() {
    const yearSelect = document.getElementById('analysisYear');
    if (!yearSelect) return;
    
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    
    yearSelect.innerHTML = '';
    
    for (let year = currentYear; year >= currentYear - 3; year--) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = `${year}년`;
        if (year === currentYear) option.selected = true;
        yearSelect.appendChild(option);
    }
    
    document.getElementById('analysisMonth').value = currentMonth;
}

async function loadMonthlyAnalysis() {
    const year = document.getElementById('analysisYear')?.value;
    const month = document.getElementById('analysisMonth')?.value;
    const department = document.getElementById('analysisDepartment')?.value;
    const resultsDiv = document.getElementById('analysisResults');
    const chartSection = document.querySelector('.chart-section');
    const detailSection = document.querySelector('.detail-analysis-section');
    
    if (!year || !month) {
        resultsDiv.innerHTML = '<div class="analysis-info">연도와 월을 선택해주세요.</div>';
        return;
    }
    
    if (!department) {
        resultsDiv.innerHTML = '<div class="analysis-info">부서를 선택해주세요.</div>';
        return;
    }
    
    try {
        resultsDiv.innerHTML = '<div class="analysis-info">분석 중...</div>';
        
        // 해당 월의 모든 주차 계산 (대략적으로 4-5주)
        const startDate = `${year}-${month.padStart(2, '0')}-01`;
        const endDate = new Date(year, month, 0).toISOString().split('T')[0];
        
        // 해당 부서의 모든 주간 업무일지 조회
        let query = `${SUPABASE_URL}/rest/v1/weekly_work_diary?select=*&department=eq.${department}&week_start_date=gte.${startDate}&week_end_date=lte.${endDate}&order=manager_name.asc,week_number.asc`;
        
        const response = await fetch(query, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });
        
        if (!response.ok) {
            throw new Error('데이터를 불러올 수 없습니다.');
        }
        
        const diaries = await response.json();
        
        if (!diaries || diaries.length === 0) {
            resultsDiv.innerHTML = '<div class="analysis-info">해당 기간에 등록된 업무일지가 없습니다.</div>';
            chartSection.style.display = 'none';
            detailSection.style.display = 'none';
            return;
        }
        
        // 팀 전체 구성원 업무 현황 생성
        generateTeamAnalysis(diaries, year, month, department);
        
        // 차트와 상세 분석은 숨김
        chartSection.style.display = 'none';
        detailSection.style.display = 'none';
        
    } catch (err) {
        resultsDiv.innerHTML = `<div class="analysis-info">오류: ${err.message}</div>`;
        console.error('월간 분석 오류:', err);
    }
}

// 팀 전체 구성원 업무 분석 생성
function generateTeamAnalysis(diaries, year, month, department) {
    const resultsDiv = document.getElementById('analysisResults');
    
    // 구성원별로 데이터 그룹화
    const memberData = {};
    diaries.forEach(diary => {
        const memberName = diary.manager_name;
        if (!memberData[memberName]) {
            memberData[memberName] = [];
        }
        memberData[memberName].push(diary);
    });
    
    // 기본 통계
    const totalMembers = Object.keys(memberData).length;
    const totalWeeklyReports = diaries.length;
    const completedReports = diaries.filter(d => d.status === '완료').length;
    const avgCompletionRate = diaries.reduce((sum, d) => sum + d.completion_rate, 0) / diaries.length;
    
    let html = `
        <div class="team-overview">
            <h3>📊 ${department} ${year}년 ${month}월 업무 현황</h3>
            <div class="team-stats">
                <div class="team-stat-card">
                    <div class="stat-number">${totalMembers}</div>
                    <div class="stat-label">팀 구성원</div>
                </div>
                <div class="team-stat-card">
                    <div class="stat-number">${totalWeeklyReports}</div>
                    <div class="stat-label">주간 보고서</div>
                </div>
                <div class="team-stat-card">
                    <div class="stat-number">${completedReports}</div>
                    <div class="stat-label">완료된 보고서</div>
                </div>
                <div class="team-stat-card">
                    <div class="stat-number">${Math.round(avgCompletionRate)}%</div>
                    <div class="stat-label">평균 완성도</div>
                </div>
            </div>
        </div>
        
        <div class="team-members-section">
            <h4>👥 구성원별 업무 현황</h4>
    `;
    
    // 구성원별 업무 현황
    Object.entries(memberData).forEach(([memberName, memberDiaries]) => {
        const memberCompletionRate = memberDiaries.reduce((sum, d) => sum + d.completion_rate, 0) / memberDiaries.length;
        const memberCompletedCount = memberDiaries.filter(d => d.status === '완료').length;
        
        html += `
            <div class="member-card">
                <div class="member-header">
                    <div class="member-info">
                        <h5>👤 ${memberName}</h5>
                        <div class="member-stats">
                            <span class="member-stat">주간보고서: ${memberDiaries.length}개</span>
                            <span class="member-stat">완료: ${memberCompletedCount}개</span>
                            <span class="member-stat">평균 완성도: ${Math.round(memberCompletionRate)}%</span>
                        </div>
                    </div>
                    <div class="member-progress">
                        <div class="progress-circle" style="--progress: ${memberCompletionRate}%">
                            <span>${Math.round(memberCompletionRate)}%</span>
                        </div>
                    </div>
                </div>
                
                <div class="member-weekly-reports">
        `;
        
        // 해당 구성원의 주간 보고서들
        memberDiaries.forEach(diary => {
            const weekStartDate = new Date(diary.week_start_date).toLocaleDateString('ko-KR');
            const weekEndDate = new Date(diary.week_end_date).toLocaleDateString('ko-KR');
            
            // 요일별 업무 요약
            const dailyWorks = [
                { day: '월', work: diary.monday_work },
                { day: '화', work: diary.tuesday_work },
                { day: '수', work: diary.wednesday_work },
                { day: '목', work: diary.thursday_work },
                { day: '금', work: diary.friday_work },
                { day: '특근', work: diary.overtime_work }
            ].filter(item => item.work && item.work.trim());
            
            html += `
                <div class="weekly-report-card">
                    <div class="report-header">
                        <span class="week-info">${diary.year}년 ${diary.week_number}주차 (${weekStartDate} ~ ${weekEndDate})</span>
                        <span class="status-badge status-${diary.status}">${diary.status}</span>
                        <span class="completion-rate">${diary.completion_rate}%</span>
                    </div>
                    
                    <div class="daily-works-summary">
            `;
            
            dailyWorks.forEach(item => {
                const shortWork = item.work.length > 50 ? item.work.substring(0, 50) + '...' : item.work;
                html += `
                    <div class="daily-work-item">
                        <span class="day-label">${item.day}</span>
                        <span class="work-content">${shortWork}</span>
                    </div>
                `;
            });
            
            if (diary.weekly_summary) {
                const shortSummary = diary.weekly_summary.length > 100 ? 
                    diary.weekly_summary.substring(0, 100) + '...' : 
                    diary.weekly_summary;
                html += `
                    <div class="weekly-summary-item">
                        <span class="summary-label">📝 주간요약</span>
                        <span class="summary-content">${shortSummary}</span>
                    </div>
                `;
            }
            
            html += `
                    </div>
                </div>
            `;
        });
        
        html += `
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    
    resultsDiv.innerHTML = html;
}

// 사용자 관리 인증 확인
function checkUserAdminAuth() {
    const authSection = document.getElementById('userAuthSection');
    const mainSection = document.getElementById('userMainSection');
    
    if (sessionStorage.getItem('userAdminAuth') === 'true') {
        authSection.classList.add('hidden');
        mainSection.classList.remove('hidden');
        loadUserList();
    } else {
        authSection.classList.remove('hidden');
        mainSection.classList.add('hidden');
    }
}

// 사용자 관리 관리자 인증
function authenticateUserAdmin() {
    const password = document.getElementById('userAdminPassword').value;
    
    if (password === ADMIN_PASSWORD) {
        sessionStorage.setItem('userAdminAuth', 'true');
        document.getElementById('userAuthSection').classList.add('hidden');
        document.getElementById('userMainSection').classList.remove('hidden');
        loadUserList();
        showMessage('userSuccess', '✓ 관리자 인증이 완료되었습니다.');
    } else {
        showMessage('userAuthError', '✗ 비밀번호가 올바르지 않습니다.');
    }
}

// 새 사용자 추가
async function addNewUser() {
    const name = document.getElementById('newUserName').value.trim();
    const dept = document.getElementById('newUserDept').value;
    const password = document.getElementById('newUserPassword').value.trim();
    
    if (!name || !dept || !password) {
        showMessage('userError', '모든 필드를 입력해주세요.');
        return;
    }
    
    const loading = document.getElementById('userLoading');
    loading.classList.remove('hidden');
    
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/user_accounts`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({
                manager_name: name,
                department: dept,
                password: password,
                is_active: true
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || '사용자 추가 중 오류가 발생했습니다.');
        }
        
        // 폼 초기화
        document.getElementById('newUserName').value = '';
        document.getElementById('newUserDept').value = '';
        document.getElementById('newUserPassword').value = '';
        
        showMessage('userSuccess', '✓ 새 사용자가 추가되었습니다.');
        loadUserList();
        
    } catch (err) {
        showMessage('userError', `✗ 오류: ${err.message}`);
    } finally {
        loading.classList.add('hidden');
    }
}

// 사용자 목록 불러오기
async function loadUserList() {
    const loading = document.getElementById('userLoading');
    const userList = document.getElementById('userList');
    
    loading.classList.remove('hidden');
    
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/user_accounts?order=created_at.desc`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });
        
        if (!response.ok) {
            throw new Error('사용자 목록을 불러올 수 없습니다.');
        }
        
        const users = await response.json();
        
        if (users && users.length > 0) {
            let html = '';
            users.forEach(user => {
                const statusClass = user.is_active ? '' : 'inactive';
                const toggleText = user.is_active ? '비활성화' : '활성화';
                const toggleAction = user.is_active ? 'false' : 'true';
                
                html += `
                    <div class="user-item ${statusClass}">
                        <div class="user-name">${user.manager_name}</div>
                        <div class="user-dept">${user.department || '미지정'}</div>
                        <div class="user-password">${user.password}</div>
                        <div class="user-status">${user.is_active ? '활성' : '비활성'}</div>
                        <div class="user-actions">
                            <button class="btn-edit-user" onclick="editUser(${user.id}, '${user.manager_name}', '${user.department}', '${user.password}')">수정</button>
                            <button class="btn-toggle-user" onclick="toggleUser(${user.id}, ${toggleAction})">${toggleText}</button>
                            <button class="btn-delete-user" onclick="deleteUser(${user.id}, '${user.manager_name}')">삭제</button>
                        </div>
                    </div>
                `;
            });
            userList.innerHTML = html;
        } else {
            userList.innerHTML = '<div class="no-data">등록된 사용자가 없습니다.</div>';
        }
        
    } catch (err) {
        showMessage('userError', `✗ 오류: ${err.message}`);
        userList.innerHTML = '<div class="no-data">사용자 목록을 불러올 수 없습니다.</div>';
    } finally {
        loading.classList.add('hidden');
    }
}

// 사용자 수정
function editUser(id, name, dept, password) {
    const newName = prompt('담당자명:', name);
    if (newName === null) return;
    
    const newDept = prompt('부서:', dept);
    if (newDept === null) return;
    
    const newPassword = prompt('비밀번호:', password);
    if (newPassword === null) return;
    
    updateUser(id, newName.trim(), newDept.trim(), newPassword.trim());
}

// 사용자 정보 업데이트
async function updateUser(id, name, dept, password) {
    if (!name || !dept || !password) {
        showMessage('userError', '모든 필드를 입력해주세요.');
        return;
    }
    
    const loading = document.getElementById('userLoading');
    loading.classList.remove('hidden');
    
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/user_accounts?id=eq.${id}`, {
            method: 'PATCH',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                manager_name: name,
                department: dept,
                password: password
            })
        });
        
        if (!response.ok) {
            throw new Error('사용자 정보 수정 중 오류가 발생했습니다.');
        }
        
        showMessage('userSuccess', '✓ 사용자 정보가 수정되었습니다.');
        loadUserList();
        
    } catch (err) {
        showMessage('userError', `✗ 오류: ${err.message}`);
    } finally {
        loading.classList.add('hidden');
    }
}

// 사용자 활성/비활성 토글
async function toggleUser(id, isActive) {
    const loading = document.getElementById('userLoading');
    loading.classList.remove('hidden');
    
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/user_accounts?id=eq.${id}`, {
            method: 'PATCH',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                is_active: isActive
            })
        });
        
        if (!response.ok) {
            throw new Error('사용자 상태 변경 중 오류가 발생했습니다.');
        }
        
        const statusText = isActive ? '활성화' : '비활성화';
        showMessage('userSuccess', `✓ 사용자가 ${statusText}되었습니다.`);
        loadUserList();
        
    } catch (err) {
        showMessage('userError', `✗ 오류: ${err.message}`);
    } finally {
        loading.classList.add('hidden');
    }
}

// 사용자 삭제
async function deleteUser(id, name) {
    if (!confirm(`정말로 "${name}" 사용자를 삭제하시겠습니까?\n\n⚠️ 이 작업은 되돌릴 수 없습니다.`)) {
        return;
    }
    
    const loading = document.getElementById('userLoading');
    loading.classList.remove('hidden');
    
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/user_accounts?id=eq.${id}`, {
            method: 'DELETE',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });
        
        if (!response.ok) {
            throw new Error('사용자 삭제 중 오류가 발생했습니다.');
        }
        
        showMessage('userSuccess', `✓ "${name}" 사용자가 삭제되었습니다.`);
        loadUserList();
        
    } catch (err) {
        showMessage('userError', `✗ 오류: ${err.message}`);
    } finally {
        loading.classList.add('hidden');
    }
}