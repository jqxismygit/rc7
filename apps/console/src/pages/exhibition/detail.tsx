import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import type { ColumnsType } from "antd/es/table";
import {
  Breadcrumb,
  Button,
  Card,
  Descriptions,
  Empty,
  Spin,
  Table,
  Typography,
  theme,
} from "antd";
import { ArrowLeftOutlined, HomeOutlined } from "@ant-design/icons";
import type { Exhibition as ExhibitionTypes } from "@cr7/types";
import { getExhibitionApi } from "@/apis/exhibition";
import { formatDateTime, formatSessionDateTime } from "@/utils/format-datetime";
import dayjs from "dayjs";
import "./exhibition.less";

type ExhibitionDetailData = ExhibitionTypes.Exhibition & {
  sessions?: ExhibitionTypes.Session[];
};

export default function ExhibitionDetailPage() {
  const { eid = "" } = useParams<{ eid: string }>();
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ExhibitionDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sessionColumns = useMemo<ColumnsType<ExhibitionTypes.Session>>(
    () => [
      {
        title: "序号",
        key: "index",
        width: 72,
        align: "center",
        render: (_, __, index) => index + 1,
      },
      {
        title: "场次日期",
        dataIndex: "session_date",
        width: 180,
        render: (v: string) => dayjs(v).format("YYYY-MM-DD"),
      },
      {
        title: "场次 ID",
        dataIndex: "id",
        ellipsis: true,
        render: (id: string) => (
          <Typography.Text copyable={{ text: id }} ellipsis>
            {id}
          </Typography.Text>
        ),
      },
    ],
    [],
  );

  useEffect(() => {
    if (!eid) {
      setLoading(false);
      setError("缺少展会 ID");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await getExhibitionApi(eid);
        if (!cancelled) {
          setData(res);
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : String(err);
          setError(msg || "加载失败");
          setData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eid]);

  return (
    <div className="exhibition-admin-page exhibition-detail-page">
      <Breadcrumb
        style={{ marginBottom: token.marginMD }}
        items={[
          {
            title: (
              <Link to="/" style={{ color: token.colorTextSecondary }}>
                <HomeOutlined /> 首页
              </Link>
            ),
          },
          {
            title: (
              <Link
                to="/exhibition"
                style={{ color: token.colorTextSecondary }}
              >
                展会
              </Link>
            ),
          },
          {
            title: (
              <span style={{ color: token.colorText }}>
                {data?.name ?? "展会详情"}
              </span>
            ),
          },
        ]}
      />

      <div style={{ marginBottom: token.marginMD }}>
        <Button
          type="link"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate("/exhibition")}
          style={{ paddingLeft: 0 }}
        >
          返回列表
        </Button>
      </div>

      <Card
        variant="borderless"
        style={{
          borderRadius: token.borderRadiusLG,
          boxShadow: token.boxShadowSecondary,
        }}
      >
        {loading ? (
          <div style={{ textAlign: "center", padding: 48 }}>
            <Spin size="large" />
          </div>
        ) : error ? (
          <Empty description={error} />
        ) : data ? (
          <>
            <Typography.Title level={4} style={{ marginTop: 0 }}>
              {data.name}
            </Typography.Title>
            <Descriptions
              column={{ xs: 1, sm: 1, md: 2 }}
              bordered
              size="middle"
            >
              <Descriptions.Item label="展会 ID" span={2}>
                <Typography.Text copyable>{data.id}</Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="展会名称" span={2}>
                {data.name}
              </Descriptions.Item>
              <Descriptions.Item label="描述" span={2}>
                {data.description}
              </Descriptions.Item>
              <Descriptions.Item label="展期">
                {formatDateTime(data.start_date)} ~{" "}
                {formatDateTime(data.end_date)}
              </Descriptions.Item>
              <Descriptions.Item label="开场 / 闭场">
                {formatSessionDateTime(data.start_date, data.opening_time)} —{" "}
                {formatSessionDateTime(data.start_date, data.closing_time)}
              </Descriptions.Item>
              <Descriptions.Item label="最晚入场">
                {formatSessionDateTime(data.start_date, data.last_entry_time)}
              </Descriptions.Item>
              <Descriptions.Item label="地点">
                {data.location}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {formatDateTime(data.created_at)}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {formatDateTime(data.updated_at)}
              </Descriptions.Item>
            </Descriptions>
          </>
        ) : (
          <Empty description="未找到展会" />
        )}
      </Card>

      {!loading && !error && data ? (
        <Card
          className="exhibition-detail-sessions-card"
          variant="borderless"
          title="场次列表"
          style={{
            marginTop: token.marginMD,
            borderRadius: token.borderRadiusLG,
            boxShadow: token.boxShadowSecondary,
          }}
        >
          <Table<ExhibitionTypes.Session>
            className="exhibition-detail-sessions-table"
            rowKey="id"
            columns={sessionColumns}
            dataSource={data.sessions ?? []}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              pageSizeOptions: [10, 20, 50, 100],
              showTotal: (total) => `共 ${total} 场`,
            }}
            locale={{ emptyText: "暂无场次数据" }}
            scroll={{ x: "max-content" }}
          />
        </Card>
      ) : null}
    </div>
  );
}
