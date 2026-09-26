import { useState, useEffect, useRef } from 'react'
import { Card, Typography, Button, message, Statistic, Row, Col, Tag, Spin, List, Empty } from 'antd'
import { CheckCircleOutlined, TrophyOutlined, CalendarOutlined, FireOutlined } from '@ant-design/icons'
import { pointsApi } from '../api/points'
import type { PointsAccount, CheckinStatus } from '../types'
import dayjs from 'dayjs'

const { Title, Text } = Typography

// 连续签到奖励规则：第 1~2 天 5 分，第 3~6 天 8 分，第 7 天起 10 分
const REWARD_TIERS = [
  { range: '第 1-2 天', points: 5, color: 'default', minStreak: 1, maxStreak: 2 },
  { range: '第 3-6 天', points: 8, color: 'blue', minStreak: 3, maxStreak: 6 },
  { range: '第 7 天起', points: 10, color: 'gold', minStreak: 7, maxStreak: Infinity },
]

function Checkin() {
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(false)
  const [status, setStatus] = useState<CheckinStatus | null>(null)
  const [account, setAccount] = useState<PointsAccount | null>(null)
  const submittingRef = useRef(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [statusRes, accountRes] = await Promise.all([
        pointsApi.getCheckinStatus(),
        pointsApi.getBalance(),
      ])
      setStatus(statusRes.data?.data || statusRes.data)
      setAccount(accountRes.data?.data || accountRes.data)
    } catch (error) {
      console.error('Failed to load checkin data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCheckin = async () => {
    // 同一页面快速点两次只发一次请求；重复签到的幂等由后端唯一索引兜底
    if (submittingRef.current) return
    if (status?.checkedToday) {
      message.info('今天已经签到过了')
      return
    }
    submittingRef.current = true
    setChecking(true)
    try {
      const res = await pointsApi.checkin()
      const body = res.data
      if (body?.success) {
        message.success(body.message || '签到成功')
      } else {
        message.info(body?.message || '今天已经签到过了')
      }
      await loadData()
    } catch (error) {
      // 错误提示已由 axios 拦截器统一处理（如“今天已经签到过了，本次只计一次”）
      await loadData()
    } finally {
      submittingRef.current = false
      setChecking(false)
    }
  }

  const checkedToday = status?.checkedToday ?? false
  const streak = status?.streak ?? 0
  const todayPoints = status?.todayPoints ?? 5
  const recentCheckins = status?.recentCheckins ?? []

  // 今日签到完成后所处的连续天数，用于高亮当前命中的奖励档位
  const activeStreak = checkedToday
    ? streak
    : streak > 0
      ? streak + 1
      : 1

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <Spin spinning={loading}>
        <Card style={{ marginBottom: 24 }}>
          <div style={{ textAlign: 'center' }}>
            <Title level={2}>每日签到</Title>
            <div style={{ fontSize: 64, margin: 24 }}>
              {checkedToday ? (
                <CheckCircleOutlined style={{ color: '#52c41a' }} />
              ) : (
                <CalendarOutlined style={{ color: '#1890ff' }} />
              )}
            </div>

            <Row gutter={16} style={{ maxWidth: 480, margin: '0 auto 24px' }}>
              <Col span={12}>
                <Statistic
                  title="连续签到"
                  value={streak}
                  suffix="天"
                  prefix={<FireOutlined style={{ color: '#fa541c' }} />}
                  valueStyle={{ color: streak > 0 ? '#fa541c' : undefined }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title={checkedToday ? '今日已获得' : '今日签到可得'}
                  value={todayPoints}
                  suffix="积分"
                  prefix={<TrophyOutlined style={{ color: '#faad14' }} />}
                  valueStyle={{ color: '#faad14' }}
                />
              </Col>
            </Row>

            <div style={{ marginBottom: 16 }}>
              {REWARD_TIERS.map((tier) => {
                const active = activeStreak >= tier.minStreak && activeStreak <= tier.maxStreak
                return (
                  <Tag
                    key={tier.range}
                    color={active ? tier.color : 'default'}
                    style={{ fontSize: 14, padding: '4px 12px', margin: 4 }}
                  >
                    {tier.range} {tier.points} 分{active ? ' · 当前' : ''}
                  </Tag>
                )
              })}
            </div>

            <div style={{ marginBottom: 24 }}>
              {checkedToday ? (
                <Tag color="green" style={{ fontSize: 16, padding: '8px 16px' }}>
                  今日已签到，连续第 {streak} 天 +{todayPoints} 积分
                </Tag>
              ) : (
                <Text type="secondary" style={{ fontSize: 16 }}>
                  {streak > 0
                    ? `昨日连续签到 ${streak} 天，今天签到可得 ${todayPoints} 积分，别断签哦~`
                    : '今天签到从第 1 天开始，连续签到有更多奖励哦~'}
                </Text>
              )}
            </div>
            <Button
              type="primary"
              size="large"
              onClick={handleCheckin}
              loading={checking}
              disabled={checkedToday}
              style={{ minWidth: 200, height: 48, fontSize: 18 }}
            >
              {checkedToday ? '已签到' : '立即签到'}
            </Button>
          </div>
        </Card>

        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={12}>
            <Card>
              <Statistic
                title="当前积分"
                value={account?.balance || 0}
                prefix={<TrophyOutlined style={{ color: '#faad14' }} />}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
          <Col span={12}>
            <Card>
              <Statistic
                title="累计获得"
                value={account?.totalEarned || 0}
                prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              />
            </Card>
          </Col>
        </Row>

        <Card title="最近签到记录" style={{ marginBottom: 24 }}>
          {recentCheckins.length > 0 ? (
            <List
              size="small"
              dataSource={recentCheckins}
              renderItem={(record) => (
                <List.Item
                  style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0' }}
                >
                  <div>
                    <div style={{ fontWeight: 500 }}>
                      {dayjs(record.date).format('YYYY-MM-DD')}
                      {dayjs(record.date).isSame(dayjs(), 'day') && (
                        <Tag color="green" style={{ marginLeft: 8 }}>今天</Tag>
                      )}
                    </div>
                    <div style={{ color: '#999', fontSize: 12 }}>
                      连续第 {record.streak ?? 1} 天 · {dayjs(record.createdAt).format('HH:mm')} 签到
                    </div>
                  </div>
                  <span style={{ fontWeight: 600, color: '#52c41a' }}>
                    +{record.points ?? 5} 积分
                  </span>
                </List.Item>
              )}
            />
          ) : (
            <Empty description="暂无签到记录，今天是连续第 1 天" />
          )}
        </Card>
      </Spin>
    </div>
  )
}

export default Checkin
