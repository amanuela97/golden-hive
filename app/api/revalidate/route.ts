import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { secret, tag, path } = body ?? {};

    if (!secret || secret !== process.env.REVALIDATE_SECRET) {
      return NextResponse.json(
        { revalidated: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    if (tag) {
      revalidateTag(tag, "default");
      return NextResponse.json({ revalidated: true, by: "tag", tag });
    }

    if (path) {
      revalidatePath(path);
      return NextResponse.json({ revalidated: true, by: "path", path });
    }

    return NextResponse.json(
      { revalidated: false, message: "No tag or path provided" },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { revalidated: false, message: "Error", error: (error as Error).message },
      { status: 500 }
    );
  }
}
