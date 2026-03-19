import { useMemo, useState } from "react";
import { message } from "antd";
import type { Exhibition as ExhibitionTypes } from "@cr7/types";
import {
  ProForm,
  ProFormDatePicker,
  ProFormText,
  ProFormTextArea,
  ProFormTimePicker,
} from "@ant-design/pro-components";
import { createExhibitionApi } from "@/apis/index";

type CreateExhibitionInput = Omit<ExhibitionTypes.Exhibition, "id" | "created_at" | "updated_at">;

type DayjsLike = {
  format: (fmt: string) => string;
};

function formatDayjsLike(value: unknown, fmt: string) {
  if (value && typeof value === "object" && "format" in value) {
    return (value as DayjsLike).format(fmt);
  }
  return value;
}

const ExhibitionCreatePage = () => {
  const [submitting, setSubmitting] = useState(false);

  const submitter = useMemo(
    () => ({
      searchConfig: {
        submitText: submitting ? "创建中..." : "创建展会",
      },
      resetButtonProps: { children: "重置" },
    }),
    [submitting],
  );

  async function handleFinish(values: CreateExhibitionInput) {
    // 由于 start_date/end_date/opening_time/closing_time 都是 "YYYY-MM-DD"/"HH:mm:ss" 格式，字典序可直接比较。
    if (values.start_date > values.end_date) {
      message.error("开始日期不能晚于结束日期");
      return false;
    }
    if (values.opening_time > values.closing_time) {
      message.error("开场时间不能晚于闭场时间");
      return false;
    }
    if (values.last_entry_time > values.closing_time) {
      message.error("最晚入场时间不能晚于闭场时间");
      return false;
    }

    try {
      setSubmitting(true);
      await createExhibitionApi(values);
      message.success("展会创建成功");
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      message.error(errMsg ? `展会创建失败：${errMsg}` : "展会创建失败");
    } finally {
      setSubmitting(false);
    }
    return true;
  }

  return (
    <ProForm<CreateExhibitionInput>
      layout="vertical"
      submitter={submitter}
      onFinish={handleFinish}
      initialValues={{
        location: "",
        name: "",
        description: "",
      }}
    >
      <ProFormText
        name="name"
        label="展会名称"
        placeholder="请输入展会名称"
        rules={[{ required: true, message: "请输入展会名称" }]}
      />

      <ProFormTextArea
        name="description"
        label="展会描述"
        placeholder="请输入展会描述"
        rules={[{ required: true, message: "请输入展会描述" }]}
      />

      <ProFormDatePicker
        name="start_date"
        label="开始日期"
        placeholder="请选择开始日期"
        fieldProps={{ format: "YYYY-MM-DD" }}
        transform={(value: unknown) => formatDayjsLike(value, "YYYY-MM-DD")}
        rules={[{ required: true, message: "请选择开始日期" }]}
      />

      <ProFormDatePicker
        name="end_date"
        label="结束日期"
        placeholder="请选择结束日期"
        fieldProps={{ format: "YYYY-MM-DD" }}
        transform={(value: unknown) => formatDayjsLike(value, "YYYY-MM-DD")}
        rules={[{ required: true, message: "请选择结束日期" }]}
      />

      <ProFormTimePicker
        name="opening_time"
        label="开场时间"
        placeholder="请选择开场时间"
        fieldProps={{ format: "HH:mm:ss" }}
        transform={(value: unknown) => formatDayjsLike(value, "HH:mm:ss")}
        rules={[{ required: true, message: "请选择开场时间" }]}
      />

      <ProFormTimePicker
        name="closing_time"
        label="闭场时间"
        placeholder="请选择闭场时间"
        fieldProps={{ format: "HH:mm:ss" }}
        transform={(value: unknown) => formatDayjsLike(value, "HH:mm:ss")}
        rules={[{ required: true, message: "请选择闭场时间" }]}
      />

      <ProFormTimePicker
        name="last_entry_time"
        label="最晚入场时间"
        placeholder="请选择最晚入场时间"
        fieldProps={{ format: "HH:mm:ss" }}
        transform={(value: unknown) => formatDayjsLike(value, "HH:mm:ss")}
        rules={[{ required: true, message: "请选择最晚入场时间" }]}
      />

      <ProFormText
        name="location"
        label="地点"
        placeholder="请输入地点"
        rules={[{ required: true, message: "请输入地点" }]}
      />
    </ProForm>
  );
};

export default ExhibitionCreatePage;
