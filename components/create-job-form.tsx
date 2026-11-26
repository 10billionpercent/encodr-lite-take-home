"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createJobSchema, type CreateJobInput } from "@/lib/schemas";
import { useCreateJob } from "@/lib/client/hooks";
import { ApiError } from "@/lib/client/api";

export default function CreateJobForm() {
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateJobInput>({
    resolver: zodResolver(createJobSchema),
    defaultValues: { sourceUrl: "", title: "" },
  });

  const createJob = useCreateJob();

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await createJob.mutateAsync(values);
      reset();
    } catch (e) {
      if (e instanceof ApiError && e.fieldErrors) {
        if (e.fieldErrors.sourceUrl) {
          setError("sourceUrl", {
            message: e.fieldErrors.sourceUrl[0],
          });
        }
        if (e.fieldErrors.title) {
          setError("title", {
            message: e.fieldErrors.title[0],
          });
        }
      } else {
        setFormError(e instanceof Error ? e.message : "Job creation failed");
      }
    }
  });

  return (
    <div className="mx-auto flex max-w-sm flex-col justify-center px-4">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="source-url"
            className="mb-1 block text-sm font-medium"
          >
            Source URL
          </label>
          <input
            id="source-url"
            {...register("sourceUrl")}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
          {errors.sourceUrl && (
            <p className="mt-1 text-xs text-red-600">
              {errors.sourceUrl.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="title" className="mb-1 block text-sm font-medium">
            Title
          </label>
          <input
            id="title"
            {...register("title")}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
          {errors.title && (
            <p className="mt-1 text-xs text-red-600">{errors.title.message}</p>
          )}
        </div>

        {formError && <p className="text-sm text-red-600">{formError}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? "Creating job..." : "Create job"}
        </button>
      </form>
    </div>
  );
}
