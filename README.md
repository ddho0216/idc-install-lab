# IDC 장비 설치 실습 (가상)

새 스위치 1대가 IDC에 입고되어 관제에 잡힐 때까지를 3D로 연습하는 정적 웹페이지입니다.
**장비 모델·시리얼·IP·VLAN·community·센터 구성은 전부 지어낸 가상 값입니다.** 실제 회사·장비와 무관합니다.

## 단계
1. 입고·검수 (입고서와 현물 대조, 시나리오는 매번 무작위)
2. 랙 마운트 (위치·방향 규칙)
3. 전원 연결 (PDU A/B 이중화)
4. 광 케이블링 (코어 2대, 광 Tx/Rx 극성 문제가 무작위로 발생)
5. 콘솔 설정 (가상 CLI, Cisco 비슷한 문법)
6. 관제 연동 (등록 → ping/SNMP 검증 → 그래프)

## 실행
```bash
python3 -m http.server 8000   # 열기: http://localhost:8000
node tests/cli.test.js        # 가상 CLI 테스트
```
빌드 과정이 없습니다. Vercel에서는 이 폴더를 그대로 Import하면 됩니다.

three.js(`vendor/`)는 MIT 라이선스입니다.
