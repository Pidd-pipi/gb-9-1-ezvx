package com.knowledge.platform.dto;

import com.knowledge.platform.entity.Checkin;
import lombok.Data;

import java.util.List;

@Data
public class CheckinStatus {
    /** 今天是否已经签到。 */
    private boolean checkedToday;

    /** 当前连续签到天数（未签到时展示昨日为止的连续天数，签到后展示含今日的天数）。 */
    private int streak;

    /** 当天签到可获得（或已获得）的积分。 */
    private int todayPoints;

    /** 最近签到记录（最多 7 条，按日期倒序）。 */
    private List<Checkin> recentCheckins;
}
