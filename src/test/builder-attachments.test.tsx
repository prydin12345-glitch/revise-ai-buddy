import { afterEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  WorkspaceContext,
  WorkspaceStore,
} from "@/hooks/use-workspace-session";
import {
  useBuilderAttachments,
  type BuilderAttachment,
} from "@/hooks/useBuilderAttachments";
import { BuilderAttachments } from "@/components/profiles/BuilderAttachments";

afterEach(cleanup);
const textFile = (
  name = "syllabus.txt",
  text = "Original syllabus",
  extra: Partial<File> = {},
): File => {
  const bytes = new TextEncoder().encode(text);
  return {
    name,
    type: "text/plain",
    size: bytes.length,
    arrayBuffer: vi.fn(async () => bytes.buffer.slice(0)),
    ...extra,
  } as File;
};
const workspace =
  (store = new WorkspaceStore("account-a")) =>
  ({ children }: { children: React.ReactNode }) => (
    <WorkspaceContext.Provider
      value={{ store, ownerId: store.ownerId, ready: true }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
const setup = () =>
  renderHook(
    () =>
      useBuilderAttachments({ accountId: "account-a", subjectName: "Biology" }),
    { wrapper: workspace() },
  );
const select = async (
  result: ReturnType<typeof setup>["result"],
  files?: File[],
) => {
  let accepted = false;
  await act(async () => {
    accepted = await result.current.selectFiles(files);
  });
  return accepted;
};

describe("builder attachment state", () => {
  it("retains an attached payload when the picker is cancelled or returns an empty selection", async () => {
    const { result } = setup();
    expect(await select(result, [textFile()])).toBe(true);
    const previous = result.current.files;
    expect(previous[0]).toMatchObject({
      name: "syllabus.txt",
      contentType: "text/plain",
      base64: btoa("Original syllabus"),
      status: "attached",
    });
    expect(await select(result)).toBe(false);
    expect(await select(result, [])).toBe(false);
    expect(result.current.files).toBe(previous);
    expect(result.current.readError).toBe("");
  });

  it.each([
    [
      "an oversized replacement",
      () => [
        textFile("large.pdf", "PDF", {
          type: "application/pdf",
          size: 3_000_001,
        }),
      ],
    ],
    [
      "an unsupported replacement",
      () => [textFile("photo.jpg", "image", { type: "image/jpeg" })],
    ],
    [
      "too many replacements",
      () =>
        Array.from({ length: 4 }, (_, i) =>
          textFile(`file-${i}.txt`, `content-${i}`),
        ),
    ],
    ["an empty file", () => [textFile("empty.txt", "")]],
    [
      "an oversized combined selection",
      () =>
        Array.from({ length: 3 }, (_, i) =>
          textFile(`large-${i}.txt`, `content-${i}`, { size: 2_000_001 }),
        ),
    ],
  ])("keeps current files after %s", async (_label, choice) => {
    const { result } = setup();
    await select(result, [textFile()]);
    const previous = result.current.files;
    const files = choice();
    expect(await select(result, files)).toBe(false);
    expect(result.current.files).toBe(previous);
    expect(result.current.readError).toMatch(/unchanged/);
    expect(result.current.busy).toBe(false);
    files.forEach((file) => expect(file.arrayBuffer).not.toHaveBeenCalled());
  });

  it("replaces the bundle only after every file has been read successfully", async () => {
    const { result } = setup();
    await select(result, [textFile()]);
    const previous = result.current.files;
    const broken = textFile("second.txt", "second", {
      arrayBuffer: vi.fn(async () => {
        throw Error("Could not read this file.");
      }),
    });
    expect(await select(result, [textFile("first.txt", "first"), broken])).toBe(
      false,
    );
    expect(result.current.files).toBe(previous);
    expect(result.current.readError).toMatch(/Could not read/);
    expect(result.current.busy).toBe(false);
  });

  it("the most recent selection wins if file reads resolve out of order", async () => {
    const { result } = setup();
    let finish!: (buffer: ArrayBuffer) => void;
    const first = textFile("slow.txt", "slow", {
      arrayBuffer: vi.fn(
        () =>
          new Promise<ArrayBuffer>((resolve) => {
            finish = resolve;
          }),
      ),
    });
    let pending!: Promise<boolean>;
    act(() => {
      pending = result.current.selectFiles([first]);
    });
    expect(result.current.busy).toBe(true);
    expect(await select(result, [textFile("current.txt", "current")])).toBe(
      true,
    );
    await act(async () => {
      finish(new TextEncoder().encode("slow").buffer);
      expect(await pending).toBe(false);
    });
    expect(result.current.files.map((file) => file.name)).toEqual([
      "current.txt",
    ]);
    expect(result.current.readError).toBe("");
  });

  it("clear and remove invalidate pending reads instead of restoring removed files", async () => {
    const { result } = setup();
    await select(result, [textFile()]);
    let finish!: (buffer: ArrayBuffer) => void;
    let pending!: Promise<boolean>;
    act(() => {
      pending = result.current.selectFiles([
        textFile("slow.txt", "slow", {
          arrayBuffer: vi.fn(
            () =>
              new Promise<ArrayBuffer>((resolve) => {
                finish = resolve;
              }),
          ),
        }),
      ]);
    });
    act(() => result.current.remove(result.current.files[0].id));
    await act(async () => {
      finish(new TextEncoder().encode("slow").buffer);
      expect(await pending).toBe(false);
    });
    expect(result.current.files).toEqual([]);
    expect(result.current.busy).toBe(false);
    await select(result, [
      textFile("first.txt", "first"),
      textFile("second.txt", "second"),
    ]);
    act(() => result.current.remove(result.current.files[0].id));
    expect(result.current.files.map((file) => file.name)).toEqual([
      "second.txt",
    ]);
    act(() => result.current.clear());
    expect(result.current.files).toEqual([]);
  });

  it("keeps files across remounts in the same account/subject without browser storage", async () => {
    const set = vi.spyOn(Storage.prototype, "setItem");
    const store = new WorkspaceStore("account-a"),
      wrapper = workspace(store);
    const first = renderHook(
      () =>
        useBuilderAttachments({
          accountId: "account-a",
          subjectName: "Biology",
        }),
      { wrapper },
    );
    await select(first.result, [textFile()]);
    const id = first.result.current.files[0].id;
    first.unmount();
    const again = renderHook(
      () =>
        useBuilderAttachments({
          accountId: "account-a",
          subjectName: " biology ",
        }),
      { wrapper },
    );
    expect(again.result.current.files[0].id).toBe(id);
    const otherSubject = renderHook(
      () =>
        useBuilderAttachments({
          accountId: "account-a",
          subjectName: "Physics",
        }),
      { wrapper },
    );
    expect(otherSubject.result.current.files).toEqual([]);
    const otherAccount = renderHook(
      () =>
        useBuilderAttachments({
          accountId: "account-b",
          subjectName: "Biology",
        }),
      { wrapper: workspace(new WorkspaceStore("account-b")) },
    );
    expect(otherAccount.result.current.files).toEqual([]);
    expect(set).not.toHaveBeenCalled();
    set.mockRestore();
  });

  it("does not retain file bytes in the anonymous fallback store", async () => {
    const first = renderHook(() =>
      useBuilderAttachments({ subjectName: "Biology" }),
    );
    await select(first.result, [textFile()]);
    first.unmount();
    const second = renderHook(() =>
      useBuilderAttachments({ subjectName: "Biology" }),
    );
    expect(second.result.current.files).toEqual([]);
  });

  it("does not finish an old account's pending upload after switching scopes", async () => {
    const firstStore = new WorkspaceStore("account-a"),
      secondStore = new WorkspaceStore("account-b");
    let finish!: (buffer: ArrayBuffer) => void;
    let pending!: Promise<boolean>;
    const resultView = renderHook(
      ({ account, store }: { account: string; store: WorkspaceStore }) => {
        // Scope changes below use the account mismatch guard even if a preview
        // momentarily retains the old workspace provider.
        return useBuilderAttachments({
          accountId: account,
          subjectName: "Biology",
        });
      },
      {
        initialProps: { account: "account-a", store: firstStore },
        wrapper: workspace(firstStore),
      },
    );
    act(() => {
      pending = resultView.result.current.selectFiles([
        textFile("slow.txt", "slow", {
          arrayBuffer: vi.fn(
            () =>
              new Promise<ArrayBuffer>((resolve) => {
                finish = resolve;
              }),
          ),
        }),
      ]);
    });
    resultView.rerender({ account: "account-b", store: secondStore });
    expect(resultView.result.current.files).toEqual([]);
    await act(async () => {
      finish(new TextEncoder().encode("slow").buffer);
      expect(await pending).toBe(false);
    });
    expect(resultView.result.current.files).toEqual([]);
    resultView.rerender({ account: "account-a", store: firstStore });
    expect(resultView.result.current.files).toEqual([]);
  });

  it("marks evidence stale without discarding files when assessment details change", async () => {
    const { result } = setup();
    await select(result, [textFile()]);
    const payload = result.current.files[0].base64;
    act(() => result.current.setStatus("checked"));
    expect(result.current.files[0].status).toBe("checked");
    act(() => result.current.markForRecheck());
    expect(result.current.files[0]).toMatchObject({
      base64: payload,
      status: "needs_recheck",
    });
    act(() => result.current.setStatus("reading"));
    expect(result.current.files[0].status).toBe("reading");
  });

  it("rejects duplicate documents and misleading file sizes atomically", async () => {
    const { result } = setup();
    await select(result, [textFile()]);
    const previous = result.current.files;
    expect(
      await select(result, [
        textFile("one.txt", "same"),
        textFile("two.txt", "same"),
      ]),
    ).toBe(false);
    expect(result.current.files).toBe(previous);
    expect(result.current.readError).toMatch(/only once/);
    const bytes = new Uint8Array(3_000_001);
    expect(
      await select(result, [
        textFile("lying.txt", "small", {
          arrayBuffer: vi.fn(async () => bytes.buffer),
        }),
      ]),
    ).toBe(false);
    expect(result.current.files).toBe(previous);
    expect(result.current.readError).toMatch(/3 MB/);
  });
});

describe("visible attachment controls", () => {
  const attachment: BuilderAttachment = {
    id: "file-id",
    name: "Original syllabus.pdf",
    size: 1500,
    contentType: "application/pdf",
    base64: "private-bytes",
    status: "needs_recheck",
  };
  it("keeps inactive filenames visible with a remove action and no payload in the DOM", () => {
    const onRemove = vi.fn();
    const view = render(
      <BuilderAttachments
        files={[attachment]}
        busy={false}
        active={false}
        showPicker={false}
        onSelect={vi.fn()}
        onRemove={onRemove}
        onClear={vi.fn()}
      />,
    );
    expect(screen.getByText("Original syllabus.pdf")).toBeVisible();
    expect(screen.getByText("Not used for this build")).toBeVisible();
    expect(view.container.textContent).not.toContain("private-bytes");
    fireEvent.click(
      screen.getByRole("button", { name: "Remove Original syllabus.pdf" }),
    );
    expect(onRemove).toHaveBeenCalledWith("file-id");
  });
  it("uses truthful recheck status and ignores an empty picker event", async () => {
    const onSelect = vi.fn();
    render(
      <BuilderAttachments
        files={[attachment]}
        busy={false}
        active
        onSelect={onSelect}
        onRemove={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    expect(
      screen.getByText("Details changed — ready to check again"),
    ).toBeVisible();
    const input = screen.getByLabelText("Syllabus or assessment brief");
    const pick = vi.spyOn(input as HTMLInputElement, "click");
    fireEvent.click(screen.getByRole("button", { name: "Replace files" }));
    expect(pick).toHaveBeenCalledOnce();
    fireEvent.change(input, { target: { files: [] } });
    expect(onSelect).not.toHaveBeenCalled();
    const file = textFile();
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith([file]));
    expect(screen.getByText("Original syllabus.pdf")).toBeVisible();
  });
});
