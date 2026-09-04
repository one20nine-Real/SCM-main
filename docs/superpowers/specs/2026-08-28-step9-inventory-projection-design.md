# STEP 9 Lead Time 정책화와 Inventory Projection 설계

기존 `analytics.v_stockout_risk`의 평균 사용량 나눗셈을 제거하고, DB view가 Champion Forecast, 현재고, 예정입고, 확정수주, 가예약을 월별로 누적한다. Effective Lead Time은 품목별 관리자 확정값, 공급처 관리자 확정값, 실적 P80 순으로 선택하며, 정책 변경은 이력과 audit log에 남긴다.

`analytics.v_inventory_projection`은 `Beginning + Scheduled Receipt - Confirmed Sales Order - Soft Allocation - Forecast Demand`를 계산하고, `analytics.v_stockout_risk`는 최초 Ending Inventory <= 0 기간과 Effective Lead Time 비교로 Risk Status를 산출한다. 재고·Forecast·Lead Time이 없으면 숫자나 SAFE로 보정하지 않고 reason code를 반환한다.
